import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { RoomStore } from '../server/rooms';
import { phaseView } from '../shared/phase-view';
import { GAME_PHASES, type GamePhase, type PlayerSession } from '../shared/types';

async function completedRoundFixture() {
  const store = new RoomStore(() => {}, { answer: 1000, bluff: 1000, debate: 1000, 'debate-transition': 1, vote: 1000 });
  const names = ['Host', 'Perry', 'Mark', 'Renee'];
  const host = store.create(names[0], 'socket-0');
  const sessions = [host, ...names.slice(1).map((name, index) => store.join(host.roomCode, name, `socket-${index + 1}`))];
  store.start(host.roomCode, host.playerId, 'socket-0');
  const room = store.getRoom(host.roomCode);
  const correct = room.question!.correctAnswer;
  [correct, 'Wrong one', 'Wrong two', 'Wrong three'].forEach((answer, index) => store.submit(host.roomCode, sessions[index].playerId, `socket-${index}`, 'answer', answer));
  ['Shared bluff', 'Shared bluff', correct, 'Other bluff'].forEach((answer, index) => store.submit(host.roomCode, sessions[index].playerId, `socket-${index}`, 'bluff', answer));
  store.endDebate(host.roomCode, host.playerId, 'socket-0');
  await delay(5);
  const shared = room.answerPool.find((answer) => answer.text === 'Shared bluff')!;
  const truth = room.answerPool.find((answer) => answer.isCorrect)!;
  [shared.id, shared.id, shared.id, truth.id].forEach((answerId, index) => store.vote(host.roomCode, sessions[index].playerId, `socket-${index}`, answerId, false));
  assert.equal(room.phase, 'reveal');
  return { store, host, sessions, room, correct, sharedId: shared.id };
}

function reconnectView(f: Awaited<ReturnType<typeof completedRoundFixture>>, session: PlayerSession, socketId: string) {
  f.store.disconnect(f.host.roomCode, session.playerId, `socket-${f.sessions.indexOf(session)}`);
  f.store.reconnect(session, socketId);
  return f.store.view(f.host.roomCode, session.playerId);
}

test('completed vote creates a stable authoritative round snapshot with bluff outcomes', async (context) => {
  const f = await completedRoundFixture(); context.after(() => f.store.close());
  const snapshot = f.room.completedRound;
  assert.ok(snapshot);
  assert.equal(snapshot.roundNumber, 1);
  assert.equal(snapshot.question.correctAnswer, f.correct);
  assert.equal(snapshot.results.length, 4);
  const shared = snapshot.answers.find((answer) => answer.id === f.sharedId)!;
  assert.deepEqual(shared.bluffPlayerIds, [f.sessions[0].playerId, f.sessions[1].playerId]);
  assert.deepEqual(shared.bluffOutcomes.map((outcome) => [outcome.playerId, outcome.fooledPlayerIds, outcome.points]), [
    [f.sessions[0].playerId, [f.sessions[1].playerId, f.sessions[2].playerId], 200],
    [f.sessions[1].playerId, [f.sessions[0].playerId, f.sessions[2].playerId], 200],
  ]);
  const truth = snapshot.answers.find((answer) => answer.isCorrect)!;
  assert.deepEqual(truth.bluffPlayerIds, [f.sessions[2].playerId]);
  assert.deepEqual(truth.bluffOutcomes, [], 'an accidentally correct bluff earns no reward');
});

test('post-vote state survives every reveal step and reconnect, then clears at the next round', async (context) => {
  const f = await completedRoundFixture(); context.after(() => f.store.close());
  const expectedResults = f.room.completedRound!.results;
  // Prove result views use the completed snapshot instead of mutable live-round collections.
  f.room.answerPool = [];
  f.room.votes = [];
  f.room.results = [];
  f.room.question = null;

  let view = reconnectView(f, f.sessions[1], 'socket-reveal-ready');
  assert.equal(view.phase, 'reveal');
  assert.equal(view.revealStep, 'ready');
  assert.equal(view.results.length, 0);
  assert.equal(view.correctAnswer, undefined);
  assert.equal(view.answerPool.some((answer) => answer.voterIds || answer.isCorrect !== undefined || answer.bluffOutcomes), false);

  f.store.reveal(f.host.roomCode, f.host.playerId, 'socket-0');
  view = f.store.view(f.host.roomCode, f.sessions[1].playerId);
  assert.equal(view.revealStep, 'votes');
  assert.equal(view.answerPool.some((answer) => answer.voterIds?.length), true);
  assert.equal(view.correctAnswer, undefined);

  f.store.reveal(f.host.roomCode, f.host.playerId, 'socket-0');
  view = f.store.view(f.host.roomCode, f.sessions[1].playerId);
  assert.equal(view.revealStep, 'correct');
  assert.equal(view.correctAnswer, f.correct);
  assert.equal(view.answerPool.some((answer) => answer.bluffPlayerIds || answer.bluffOutcomes), false);

  f.store.reveal(f.host.roomCode, f.host.playerId, 'socket-0');
  view = reconnectView(f, f.sessions[1], 'socket-bluff-results');
  assert.equal(view.revealStep, 'bluffs');
  assert.equal(view.results.length, expectedResults.length);
  assert.equal(view.answerPool.find((answer) => answer.id === f.sharedId)?.bluffOutcomes?.length, 2);

  f.store.reveal(f.host.roomCode, f.host.playerId, 'socket-0');
  view = reconnectView(f, f.sessions[1], 'socket-round-results');
  assert.equal(view.phase, 'results');
  assert.deepEqual(view.results, expectedResults);
  assert.equal(view.players.every((player) => view.results.some((result) => result.playerId === player.id && result.totalScore === player.score)), true);

  f.store.advanceGame(f.host.roomCode, f.host.playerId, 'socket-0');
  assert.equal(f.room.phase, 'answer');
  assert.equal(f.room.completedRound, null);
  assert.deepEqual(f.room.results, []);
  assert.deepEqual(f.room.votes, []);
  assert.deepEqual(f.room.answerPool, []);
});

test('shared display gets sanitized but complete state at the appropriate reveal stages', async (context) => {
  const f = await completedRoundFixture(); context.after(() => f.store.close());
  let display = f.store.displayView(f.host.roomCode);
  assert.equal(display.correctAnswer, undefined, 'ready reveal does not identify the correct answer');
  assert.equal(display.explanation, undefined);
  assert.equal(display.results.length, 0);
  assert.equal(display.answerPool.some((answer) => answer.voterIds || answer.bluffPlayerIds || answer.bluffOutcomes), false);

  f.store.reveal(f.host.roomCode, f.host.playerId, 'socket-0');
  display = f.store.displayView(f.host.roomCode);
  assert.equal(display.correctAnswer, undefined);
  assert.equal(display.answerPool.some((answer) => answer.voterIds?.length), true);

  f.store.reveal(f.host.roomCode, f.host.playerId, 'socket-0');
  f.store.reveal(f.host.roomCode, f.host.playerId, 'socket-0');
  display = f.store.displayView(f.host.roomCode);
  assert.equal(display.correctAnswer, f.correct);
  assert.equal(display.results.length, 4);
  assert.equal(display.answerPool.find((answer) => answer.id === f.sharedId)?.bluffOutcomes?.length, 2);

  f.store.reveal(f.host.roomCode, f.host.playerId, 'socket-0');
  display = f.store.displayView(f.host.roomCode);
  assert.equal(display.phase, 'results');
  assert.equal(display.results.length, 4);
});

test('every game phase maps to a concrete player and display view', () => {
  const expected: Record<GamePhase, string> = {
    lobby: 'lobby', answer: 'answer', bluff: 'bluff', debate: 'debate', 'debate-transition': 'debate', vote: 'vote', reveal: 'reveal', results: 'results', 'final-results': 'final-results',
  };
  for (const phase of GAME_PHASES) assert.equal(phaseView(phase, 'ready'), expected[phase]);
  assert.equal(phaseView('reveal', 'bluffs'), 'bluff-results');
});
