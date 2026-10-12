import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { RoomStore } from '../server/rooms';

function fixture(names = ['Suriya', 'Perry', 'Mark', 'Hunter'], durations = { answer: 1000, bluff: 1000, debate: 15, vote: 1000 }) {
  const broadcasts: string[] = [];
  const store = new RoomStore((code) => broadcasts.push(code), durations);
  const host = store.create(names[0], 'socket-0');
  const sessions = [host, ...names.slice(1).map((name, index) => store.join(host.roomCode, name, `socket-${index + 1}`))];
  const code = host.roomCode;
  const send = (index: number, phase: 'answer' | 'bluff', text: string) => store.submit(code, sessions[index].playerId, `socket-${index}`, phase, text);
  const vote = (index: number, text: string, hill = false) => store.vote(code, sessions[index].playerId, `socket-${index}`, store.getRoom(code).answerPool.find((answer) => answer.text === text)!.id, hill);
  const reveal = () => store.reveal(code, host.playerId, 'socket-0');
  return { store, host, sessions, code, send, vote, reveal, broadcasts };
}

test('private submissions, merged pool, and progressive reveal do not leak metadata', async (context) => {
  const f = fixture();
  context.after(() => f.store.close());
  assert.match(f.code, /^[A-HJ-NP-Z]{4}$/);
  f.store.start(f.code, f.host.playerId, 'socket-0');
  const correct = f.store.getRoom(f.code).question!.correctAnswer;
  f.send(0, 'answer', ' Wrong A ');
  const privateView = f.store.view(f.code, f.sessions[1].playerId);
  assert.equal(privateView.answeredCount, 1);
  assert.equal(privateView.me.genuineAnswer, null);
  assert.equal(JSON.stringify(privateView).includes('Wrong A'), false);
  f.send(1, 'answer', 'Wrong B'); f.send(2, 'answer', ` ${correct.toUpperCase()} `); f.send(3, 'answer', correct.toLowerCase());
  assert.equal(f.store.getRoom(f.code).phase, 'bluff');
  f.send(0, 'bluff', 'Bluff A'); f.send(1, 'bluff', 'Wrong A'); f.send(2, 'bluff', ' wrong a '); f.send(3, 'bluff', correct);
  const debate = f.store.view(f.code, f.host.playerId);
  assert.equal(debate.phase, 'debate');
  assert.equal(debate.answerPool.length, 4);
  for (const option of debate.answerPool) assert.deepEqual(Object.keys(option).sort(), ['id', 'text']);
  assert.deepEqual(Object.keys(debate.question!).sort(), ['id', 'text']);
  assert.equal(debate.correctAnswer, undefined);
  const wrong = f.store.getRoom(f.code).answerPool.find((option) => option.text === 'Wrong A')!;
  assert.equal(wrong.genuinePlayerIds.length, 1);
  assert.equal(wrong.bluffPlayerIds.length, 2);
  await delay(25);
  f.vote(0, correct, true); f.vote(1, 'Wrong A'); f.vote(2, correct); f.vote(3, 'Wrong A', true);
  let view = f.store.view(f.code, f.host.playerId);
  assert.equal(view.phase, 'reveal');
  assert.equal(view.revealStep, 'ready');
  assert.equal(view.correctAnswer, undefined);
  assert.deepEqual(view.results, []);
  assert.equal(view.players.every((player) => player.score === 0), true, 'score deltas cannot leak correctness before reveal');
  assert.equal(view.answerPool.some((option) => option.voterIds || option.isCorrect !== undefined), false);
  f.reveal();
  view = f.store.view(f.code, f.host.playerId);
  assert.equal(view.revealStep, 'votes');
  assert.equal(view.answerPool.some((option) => option.voterIds?.length), true);
  assert.equal(view.answerPool.some((option) => option.isCorrect !== undefined || option.bluffPlayerIds), false);
  f.reveal();
  view = f.store.view(f.code, f.host.playerId);
  assert.equal(view.correctAnswer, correct);
  assert.equal(view.answerPool.some((option) => option.bluffPlayerIds), false);
  f.reveal();
  view = f.store.view(f.code, f.host.playerId);
  assert.equal(view.revealStep, 'bluffs');
  assert.equal(view.answerPool.find((option) => option.text === 'Wrong A')!.bluffPlayerIds!.length, 2);
  assert.equal(view.results.length, 4);
});

test('Hill doubles only final-answer points; duplicate bluff authors each earn rewards; negative scores remain valid', async (context) => {
  const f = fixture(); context.after(() => f.store.close());
  f.store.start(f.code, f.host.playerId, 'socket-0');
  const correct = f.store.getRoom(f.code).question!.correctAnswer;
  ['Wrong A', 'Wrong B', correct, correct].forEach((text, index) => f.send(index, 'answer', text));
  ['Bluff A', 'Wrong A', 'Wrong A', correct].forEach((text, index) => f.send(index, 'bluff', text));
  await delay(25);
  f.vote(0, correct, true); f.vote(1, 'Wrong A'); f.vote(2, correct); f.vote(3, 'Wrong A', true);
  const room = f.store.getRoom(f.code);
  assert.deepEqual(room.results.map(({ finalAnswerPoints, bluffPoints, roundPoints, totalScore }) => ({ finalAnswerPoints, bluffPoints, roundPoints, totalScore })), [
    { finalAnswerPoints: 100, bluffPoints: 0, roundPoints: 200, totalScore: 200 },
    { finalAnswerPoints: -50, bluffPoints: 100, roundPoints: 50, totalScore: 50 },
    { finalAnswerPoints: 100, bluffPoints: 200, roundPoints: 300, totalScore: 300 },
    { finalAnswerPoints: -50, bluffPoints: 0, roundPoints: -100, totalScore: -100 },
  ]);
  f.reveal(); f.reveal(); f.reveal(); f.reveal();
  assert.equal(room.phase, 'results');
  room.totalRounds = 1;
  f.store.advanceGame(f.code, f.host.playerId, 'socket-0');
  f.store.reset(f.code, f.host.playerId, 'socket-0');
  assert.equal(room.phase, 'lobby');
  assert.equal(room.players.every((player) => player.score === 0 && !player.hillUsed), true);
  assert.equal(room.submissions.length, 0);
});

test('server rejects unauthorized, out-of-phase, invalid, changed, and expired actions', async (context) => {
  const f = fixture(['Host', 'Guest']); context.after(() => f.store.close());
  assert.throws(() => f.store.create('', 'other'), /display name/);
  assert.throws(() => f.store.join('H1LL', 'Other', 'other'), /four letters/);
  assert.throws(() => f.store.join('ZZZZ', 'Other', 'other'), /does not exist/);
  assert.throws(() => f.store.join(f.code, 'host', 'other'), /already taken/);
  assert.throws(() => f.store.start(f.code, f.sessions[1].playerId, 'socket-1'), /Only the host/);
  assert.throws(() => f.store.start(f.code, f.host.playerId, 'forged-socket'), /Reconnect/);
  f.store.start(f.code, f.host.playerId, 'socket-0');
  assert.throws(() => f.store.join(f.code, 'Other', 'other'), /already started/);
  assert.throws(() => f.send(0, 'bluff', 'Canada'), /phase has ended/);
  assert.throws(() => f.send(0, 'answer', ' '.repeat(5)), /Enter an answer/);
  assert.throws(() => f.send(0, 'answer', 'x'.repeat(81)), /80 characters/);
  f.send(0, 'answer', 'Sweden'); f.send(0, 'answer', 'Sweden');
  assert.equal(f.store.getRoom(f.code).submissions.filter((item) => item.genuineAnswer).length, 1);
  assert.throws(() => f.send(0, 'answer', 'Canada'), /already locked/);
  f.send(1, 'answer', 'Norway');
  f.send(0, 'bluff', 'Canada'); f.send(1, 'bluff', 'Finland');
  assert.throws(() => f.vote(0, 'Sweden'), /phase has ended/);
  await delay(25);
  assert.throws(() => f.store.vote(f.code, f.host.playerId, 'socket-0', 'made-up-option', false), /available cards/);
  f.vote(0, 'Sweden', true);
  f.vote(0, 'Sweden', true);
  assert.equal(f.store.getRoom(f.code).votes.length, 1);
  assert.throws(() => f.vote(0, 'Canada'), /already locked/);
  assert.equal(f.store.view(f.code, f.sessions[1].playerId).hillPlayerIds.includes(f.host.playerId), true);
  assert.equal(f.store.view(f.code, f.sessions[1].playerId).me.vote, null);
  assert.equal(f.store.view(f.code, f.sessions[1].playerId).answerPool.some((item) => item.voterIds), false);
  f.vote(1, 'Norway');
  assert.throws(() => f.store.reveal(f.code, f.sessions[1].playerId, 'socket-1'), /Only the host/);
});

test('server timers advance missed submissions and votes; clients cannot extend deadlines', async (context) => {
  const f = fixture(['Host', 'Guest'], { answer: 20, bluff: 20, debate: 20, vote: 20 });
  context.after(() => f.store.close());
  f.store.start(f.code, f.host.playerId, 'socket-0');
  await delay(120);
  const room = f.store.getRoom(f.code);
  assert.equal(room.phase, 'reveal');
  assert.equal(room.answerPool.length, 1);
  assert.equal(room.answerPool[0].text, room.question!.correctAnswer);
  assert.equal(room.results.every((item) => item.roundPoints === 0), true);
  assert.throws(() => f.send(0, 'answer', 'Sweden'), /phase has ended/);
  assert.equal(room.players.every((player) => !player.hillUsed), true);
});

test('reconnect requires secret token, preserves locks and Hill, and supersedes old sockets', async (context) => {
  const f = fixture(['Host', 'Guest']); context.after(() => f.store.close());
  f.store.start(f.code, f.host.playerId, 'socket-0');
  f.send(0, 'answer', 'Sweden');
  const deadline = f.store.getRoom(f.code).phaseEndsAt;
  assert.throws(() => f.store.reconnect({ ...f.host, reconnectToken: 'forged' }, 'new'), /could not be restored/);
  assert.equal(f.store.reconnect(f.host, 'new'), 'socket-0');
  f.store.disconnect(f.code, f.host.playerId, 'socket-0');
  assert.equal(f.store.getRoom(f.code).players[0].connected, true);
  assert.equal(f.store.view(f.code, f.host.playerId).me.genuineAnswer, 'Sweden');
  assert.equal(f.store.getRoom(f.code).phaseEndsAt, deadline);
  assert.throws(() => f.send(0, 'answer', 'Sweden'), /Reconnect/);
  f.send(1, 'answer', 'Canada');
  f.store.submit(f.code, f.host.playerId, 'new', 'bluff', 'Norway'); f.send(1, 'bluff', 'Finland');
  await delay(25);
  const sweden = f.store.getRoom(f.code).answerPool.find((option) => option.text === 'Sweden')!;
  f.store.vote(f.code, f.host.playerId, 'new', sweden.id, true);
  f.store.disconnect(f.code, f.host.playerId, 'new');
  f.store.reconnect(f.host, 'refreshed');
  const view = f.store.view(f.code, f.host.playerId);
  assert.equal(view.players[0].hillUsed, true);
  assert.equal(view.me.vote?.hill, true);
  assert.equal(view.me.vote?.answerId, sweden.id);
  assert.equal(view.hostPlayerId, f.host.playerId, 'A quick host refresh retains host controls');
  f.store.disconnect(f.code, f.host.playerId, 'refreshed', true);
  assert.equal(f.store.getRoom(f.code).hostPlayerId, f.sessions[1].playerId, 'Explicitly leaving transfers host controls');
});
