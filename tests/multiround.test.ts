import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type { Player } from '../shared/types';
import { buildLeaderboard, calculateAwards } from '../server/awards';
import { emptyStats, RoomStore } from '../server/rooms';

function fixture(names = ['Host', 'Perry', 'Mark', 'Renee']) {
  const store = new RoomStore(() => {}, { answer: 1000, bluff: 1000, debate: 1, vote: 1000 });
  const host = store.create(names[0], 'socket-0');
  const sessions = [host, ...names.slice(1).map((name, index) => store.join(host.roomCode, name, `socket-${index + 1}`))];
  const send = (index: number, phase: 'answer' | 'bluff', answer: string) => store.submit(host.roomCode, sessions[index].playerId, `socket-${index}`, phase, answer);
  const vote = (index: number, answer: string, hill = false) => store.vote(host.roomCode, sessions[index].playerId, `socket-${index}`, store.getRoom(host.roomCode).answerPool.find((option) => option.text === answer)!.id, hill);
  const revealAll = () => { for (let step = 0; step < 4; step++) store.reveal(host.roomCode, host.playerId, 'socket-0'); };
  return { store, host, sessions, send, vote, revealAll };
}

async function completeRound(f: ReturnType<typeof fixture>, useHill = false) {
  const room = f.store.getRoom(f.host.roomCode);
  const correct = room.question!.correctAnswer;
  const round = room.round;
  [correct, `Wrong ${round}-1`, `Wrong ${round}-2`, correct].forEach((answer, index) => f.send(index, 'answer', answer));
  [`Bluff ${round}-0`, `Bluff ${round}-1`, `Bluff ${round}-2`, `Bluff ${round}-3`].forEach((answer, index) => f.send(index, 'bluff', answer));
  await delay(5);
  f.vote(0, correct, useHill);
  f.vote(1, `Bluff ${round}-0`);
  f.vote(2, correct);
  f.vote(3, `Bluff ${round}-0`);
  f.revealAll();
  assert.equal(room.phase, 'results');
}

test('recommended game length follows population until the host makes an explicit choice', (context) => {
  const f = fixture(); context.after(() => f.store.close());
  const room = f.store.getRoom(f.host.roomCode);
  assert.equal(room.totalRounds, 8);
  f.store.settings(f.host.roomCode, f.host.playerId, 'socket-0', 5);
  f.store.join(f.host.roomCode, 'Fifth', 'socket-4');
  f.store.join(f.host.roomCode, 'Sixth', 'socket-5');
  assert.equal(room.totalRounds, 5, 'explicit choice is not overridden by population changes');
  f.store.settings(f.host.roomCode, f.host.playerId, 'socket-0', 'recommended');
  assert.equal(room.totalRounds, 6);
  f.store.join(f.host.roomCode, 'Seventh', 'socket-6');
  assert.equal(room.totalRounds, 6);
  f.store.join(f.host.roomCode, 'Eighth', 'socket-7');
  assert.equal(room.totalRounds, 5);
  assert.throws(() => f.store.settings(f.host.roomCode, f.sessions[1].playerId, 'socket-1', 8), /Only the host/);
});

test('recommended length is ten rounds for two or three players', (context) => {
  const f = fixture(['Host', 'Guest']); context.after(() => f.store.close());
  assert.equal(f.store.getRoom(f.host.roomCode).totalRounds, 10);
  f.store.join(f.host.roomCode, 'Third', 'socket-2');
  assert.equal(f.store.getRoom(f.host.roomCode).totalRounds, 10);
});

test('five-round game uses unique questions, persists scores and Hill, resets round state, and reaches final results', async (context) => {
  const f = fixture(); context.after(() => f.store.close());
  f.store.settings(f.host.roomCode, f.host.playerId, 'socket-0', 5);
  f.store.start(f.host.roomCode, f.host.playerId, 'socket-0');
  const room = f.store.getRoom(f.host.roomCode);
  assert.equal(room.totalRounds, 5);
  assert.equal(room.selectedQuestionIds.length, 5);
  assert.equal(new Set(room.selectedQuestionIds).size, 5);

  await completeRound(f, true);
  const firstScores = room.players.map((player) => player.score);
  assert.equal(room.players[0].hillUsed, true);
  f.store.advanceGame(f.host.roomCode, f.host.playerId, 'socket-0');
  assert.equal(room.round, 2);
  assert.deepEqual(room.players.map((player) => player.score), firstScores);
  assert.equal(room.submissions.every((item) => item.genuineAnswer === null && item.bluff === null), true);
  assert.equal(room.answerPool.length, 0);
  assert.equal(room.votes.length, 0);
  assert.equal(room.results.length, 0);
  assert.equal(room.players[0].hillUsed, true);

  const correct = room.question!.correctAnswer;
  [correct, 'Wrong 2-1', 'Wrong 2-2', correct].forEach((answer, index) => f.send(index, 'answer', answer));
  ['Bluff 2-0', 'Bluff 2-1', 'Bluff 2-2', 'Bluff 2-3'].forEach((answer, index) => f.send(index, 'bluff', answer));
  await delay(5);
  assert.throws(() => f.vote(0, correct, true), /already used your Hill/);
  f.vote(0, correct); f.vote(1, 'Bluff 2-0'); f.vote(2, correct); f.vote(3, 'Bluff 2-0'); f.revealAll();

  for (let round = 3; round <= 5; round++) { f.store.advanceGame(f.host.roomCode, f.host.playerId, 'socket-0'); await completeRound(f); }
  assert.equal(room.roundResults.length, 5);
  f.store.advanceGame(f.host.roomCode, f.host.playerId, 'socket-0');
  assert.equal(room.phase, 'final-results');
  const view = f.store.view(f.host.roomCode, f.host.playerId);
  assert.equal(view.leaderboard.length, 4);
  assert.equal(view.leaderboard[0].playerId, f.host.playerId);
  assert.deepEqual(view.awards.find((award) => award.key === 'human-wikipedia')?.winnerIds.sort(), [f.sessions[0].playerId, f.sessions[3].playerId].sort());
  assert.deepEqual(view.awards.find((award) => award.key === 'master-bullshitter')?.winnerIds, [f.sessions[0].playerId]);
  assert.deepEqual(view.awards.find((award) => award.key === 'great-recovery')?.winnerIds, [f.sessions[2].playerId]);
  assert.deepEqual(view.awards.find((award) => award.key === 'talked-out-of-it')?.winnerIds, [f.sessions[3].playerId]);
  assert.equal(view.awards.some((award) => award.key === 'worst-hill'), false);

  const playerIds = room.players.map((player) => player.id);
  f.store.reset(f.host.roomCode, f.host.playerId, 'socket-0');
  assert.equal(room.phase, 'lobby');
  assert.deepEqual(room.players.map((player) => player.id), playerIds, 'Play Again keeps the room and players');
  assert.equal(room.totalRounds, 5, 'Play Again retains the explicit setting');
  assert.equal(room.players.every((player) => player.score === 0 && !player.hillUsed && Object.values(player.stats).every((value) => value === 0 || value === false)), true);
  assert.equal(room.selectedQuestionIds.length, 0);
});

function player(id: string, score: number, correct: number, bluffs: number): Player {
  const stats = emptyStats(); stats.correctFinalAnswers = correct; stats.successfulBluffVotes = bluffs;
  return { id, name: id, score, isHost: id === 'a', hillUsed: false, connected: true, stats };
}

test('leaderboard tie-breakers retain true ties and award calculations return all tied winners', () => {
  const players = [player('a', 100, 2, 1), player('b', 100, 3, 0), player('c', 100, 3, 0), player('d', -50, 5, 9)];
  const leaderboard = buildLeaderboard(players);
  assert.deepEqual(leaderboard.map((entry) => [entry.playerId, entry.rank]), [['b', 1], ['c', 1], ['a', 3], ['d', 4]]);
  players[0].stats.correctInitialAnswers = 4; players[1].stats.correctInitialAnswers = 4;
  players[2].stats.hillUsed = true; players[2].stats.hillScoreImpact = -50;
  players[3].stats.hillUsed = true; players[3].stats.hillScoreImpact = -50;
  const awards = calculateAwards(players);
  assert.deepEqual(awards.find((award) => award.key === 'human-wikipedia')?.winnerIds, ['a', 'b']);
  assert.deepEqual(awards.find((award) => award.key === 'worst-hill')?.winnerIds, ['c', 'd']);
  assert.equal(awards.some((award) => award.key === 'great-recovery'), false, 'zero-value awards are hidden');
});
