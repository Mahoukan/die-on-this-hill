import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAcceptedAnswer, normalizeAnswer } from '../server/answer-matching';
import { RoomStore } from '../server/rooms';
import { ALL_QUESTIONS, eligibleQuestions, QUESTION_PACKS, questionById, selectQuestions } from '../server/questions';

function roomFixture() {
  const changes: string[] = [];
  const store = new RoomStore((code) => changes.push(code), { answer: 1000, bluff: 1000, debate: 1000, 'debate-transition': 10, vote: 1000 });
  const host = store.create('Host', 'socket-0');
  const guest = store.join(host.roomCode, 'Guest', 'socket-1');
  return { store, host, guest, room: store.getRoom(host.roomCode), changes };
}

test('pack and question metadata is valid and unique, with accurate availability for small packs', () => {
  assert.equal(new Set(QUESTION_PACKS.map((pack) => pack.id)).size, QUESTION_PACKS.length);
  assert.equal(new Set(ALL_QUESTIONS.map((question) => question.id)).size, ALL_QUESTIONS.length);
  const packIds = new Set(QUESTION_PACKS.map((pack) => pack.id));
  for (const pack of QUESTION_PACKS) {
    assert.ok(pack.questions.length > 0, `${pack.id} must contain questions`);
    if (!pack.id.startsWith('builtin-')) assert.ok(pack.questions.length >= 12, `${pack.id} must support a 12-round game`);
    assert.equal(pack.questions.every((question) => question.packId === pack.id && packIds.has(question.packId)), true);
  }
});

test('accepted-answer matching normalizes case, spacing, punctuation, and rejects different answers', () => {
  const everest = questionById('geo-tallest-mountain');
  assert.equal(isAcceptedAnswer(everest, '  mt.   EVEREST!! '), true);
  assert.equal(isAcceptedAnswer(everest, 'Everest'), true);
  assert.equal(isAcceptedAnswer(everest, 'K2'), false);
  assert.equal(normalizeAnswer("T'Challa"), normalizeAnswer('t’challa'));
});

test('single and mixed selection draw exactly once from only the selected packs', () => {
  const science = selectQuestions(12, ['science-technology']);
  assert.equal(science.length, 12);
  assert.equal(science.every((question) => question.packId === 'science-technology'), true);
  assert.equal(new Set(science.map((question) => question.id)).size, 12);
  const mixed = selectQuestions(12, ['geography', 'history']);
  assert.equal(mixed.length, 12);
  assert.equal(mixed.every((question) => ['geography', 'history'].includes(question.packId)), true);
  assert.equal(new Set(mixed.map((question) => question.id)).size, 12);
  assert.equal(eligibleQuestions(['geography', 'geography']).length, QUESTION_PACKS.find((pack) => pack.id === 'geography')!.questions.length);
});

test('host owns synchronized pack setup and insufficient availability blocks start', (context) => {
  const f = roomFixture(); context.after(() => f.store.close());
  f.store.questionSettings(f.host.roomCode, f.host.playerId, 'socket-0', 'mixed', ['geography', 'history']);
  const guestView = f.store.view(f.host.roomCode, f.guest.playerId);
  assert.equal(guestView.questionMode, 'mixed');
  assert.deepEqual(guestView.selectedPackIds, ['geography', 'history']);
  assert.equal(guestView.availableQuestionCount, 24);
  assert.equal(guestView.questionPacks.every((pack) => !('questions' in pack)), true);
  assert.ok(f.changes.length > 0, 'configuration change requests a room broadcast');
  assert.throws(() => f.store.questionSettings(f.host.roomCode, f.guest.playerId, 'socket-1', 'single', ['general']), /Only the host/);
  f.room.roundSetting = 12;
  f.room.totalRounds = 13;
  f.store.questionSettings(f.host.roomCode, f.host.playerId, 'socket-0', 'single', ['general']);
  assert.throws(() => f.store.start(f.host.roomCode, f.host.playerId, 'socket-0'), /Not enough questions for 13 rounds/);
});

test('reconnect restores setup and question secrets remain private until correct reveal', (context) => {
  const f = roomFixture(); context.after(() => f.store.close());
  f.store.questionSettings(f.host.roomCode, f.host.playerId, 'socket-0', 'mixed', ['science-technology', 'geography']);
  f.store.reconnect(f.guest, 'socket-new');
  const restored = f.store.view(f.host.roomCode, f.guest.playerId);
  assert.equal(restored.questionMode, 'mixed');
  assert.deepEqual(restored.selectedPackIds, ['science-technology', 'geography']);
  f.store.start(f.host.roomCode, f.host.playerId, 'socket-0');
  f.room.question = questionById('geo-most-islands');
  let view = f.store.displayView(f.host.roomCode);
  assert.equal(view.correctAnswer, undefined);
  assert.equal(view.explanation, undefined);
  assert.equal(JSON.stringify(view).includes('260,000'), false);
  f.room.phase = 'reveal'; f.room.revealStep = 'correct'; f.room.phaseEndsAt = null;
  view = f.store.displayView(f.host.roomCode);
  assert.equal(view.correctAnswer, 'Sweden');
  assert.match(view.explanation || '', /260,000 islands/);
});

test('accepted genuine answers count as correct and canonicalize into the correct answer card', (context) => {
  const f = roomFixture(); context.after(() => f.store.close());
  f.store.start(f.host.roomCode, f.host.playerId, 'socket-0');
  f.room.question = questionById('geo-tallest-mountain');
  f.store.submit(f.host.roomCode, f.host.playerId, 'socket-0', 'answer', 'Mt. Everest');
  f.store.submit(f.host.roomCode, f.guest.playerId, 'socket-1', 'answer', 'K2');
  f.store.submit(f.host.roomCode, f.host.playerId, 'socket-0', 'bluff', 'Kangchenjunga');
  f.store.submit(f.host.roomCode, f.guest.playerId, 'socket-1', 'bluff', 'Denali');
  f.store.endDebate(f.host.roomCode, f.host.playerId, 'socket-0');
  f.room.phase = 'vote'; f.room.phaseEndsAt = Date.now() + 1000;
  const correct = f.room.answerPool.find((answer) => answer.isCorrect)!;
  assert.equal(correct.text, 'Mount Everest');
  assert.deepEqual(correct.genuinePlayerIds, [f.host.playerId]);
  f.store.vote(f.host.roomCode, f.host.playerId, 'socket-0', correct.id, false);
  f.store.vote(f.host.roomCode, f.guest.playerId, 'socket-1', correct.id, false);
  assert.equal(f.room.players[0].stats.correctInitialAnswers, 1);
  assert.equal(f.room.players[0].stats.answerChanges, 0);
});

test('Play Again retains pack configuration and a new game reshuffles the sequence', (context) => {
  const f = roomFixture(); context.after(() => f.store.close());
  f.store.settings(f.host.roomCode, f.host.playerId, 'socket-0', 10);
  f.store.questionSettings(f.host.roomCode, f.host.playerId, 'socket-0', 'mixed', ['general', 'geography']);
  f.store.start(f.host.roomCode, f.host.playerId, 'socket-0');
  const firstOrder = [...f.room.selectedQuestionIds];
  f.room.phase = 'final-results'; f.room.phaseEndsAt = null;
  f.store.reset(f.host.roomCode, f.host.playerId, 'socket-0');
  assert.equal(f.room.questionMode, 'mixed');
  assert.deepEqual(f.room.selectedPackIds, ['general', 'geography']);
  f.store.start(f.host.roomCode, f.host.playerId, 'socket-0');
  assert.equal(f.room.selectedQuestionIds.length, 10);
  assert.notDeepEqual(f.room.selectedQuestionIds, firstOrder);
});
