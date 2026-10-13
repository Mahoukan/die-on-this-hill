import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAcceptedAnswer, normalizeAnswer } from '../server/answer-matching';
import type { Question } from '../shared/types';
import { RoomStore } from '../server/rooms';
import { ALL_QUESTIONS, eligibleQuestions, QUESTION_PACKS, questionById, selectQuestions } from '../server/questions';

const exampleQuestion: Question = { id: 'test-question', packId: 'test-pack', text: 'What is the example answer?', category: 'Testing', correctAnswer: 'Example Answer', acceptedAnswers: ['Example', 'The Example'], explanation: 'Private test explanation.' };

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
  assert.deepEqual(questionById(ALL_QUESTIONS[0].id), ALL_QUESTIONS[0]);
  const packIds = new Set(QUESTION_PACKS.map((pack) => pack.id));
  for (const pack of QUESTION_PACKS) {
    assert.ok(pack.questions.length > 0, `${pack.id} must contain questions`);
    assert.equal(pack.questions.every((question) => question.packId === pack.id && packIds.has(question.packId)), true);
  }
});

test('accepted-answer matching normalizes case, spacing, punctuation, and rejects different answers', () => {
  const question = exampleQuestion;
  assert.equal(isAcceptedAnswer(question, '  the.   EXAMPLE!! '), true);
  assert.equal(isAcceptedAnswer(question, 'Example'), true);
  assert.equal(isAcceptedAnswer(question, 'Different'), false);
  assert.equal(normalizeAnswer("T'Challa"), normalizeAnswer('t’challa'));
});

test('single and mixed selection draw exactly once from only the selected packs', () => {
  const science = selectQuestions(12, ['builtin-easy-science-nature']);
  assert.equal(science.length, 12);
  assert.equal(science.every((question) => question.packId === 'builtin-easy-science-nature'), true);
  assert.equal(new Set(science.map((question) => question.id)).size, 12);
  const mixed = selectQuestions(12, ['builtin-easy-geography', 'builtin-easy-history']);
  assert.equal(mixed.length, 12);
  assert.equal(mixed.every((question) => ['builtin-easy-geography', 'builtin-easy-history'].includes(question.packId)), true);
  assert.equal(new Set(mixed.map((question) => question.id)).size, 12);
  assert.equal(eligibleQuestions(['builtin-easy-geography', 'builtin-easy-geography']).length, QUESTION_PACKS.find((pack) => pack.id === 'builtin-easy-geography')!.questions.length);
});

test('host owns synchronized pack setup and insufficient availability blocks start', (context) => {
  const f = roomFixture(); context.after(() => f.store.close());
  f.store.questionSettings(f.host.roomCode, f.host.playerId, 'socket-0', 'mixed', ['builtin-easy-geography', 'builtin-easy-history']);
  const guestView = f.store.view(f.host.roomCode, f.guest.playerId);
  assert.equal(guestView.questionMode, 'mixed');
  assert.deepEqual(guestView.selectedPackIds, ['builtin-easy-geography', 'builtin-easy-history']);
  assert.equal(guestView.availableQuestionCount, eligibleQuestions(['builtin-easy-geography', 'builtin-easy-history']).length);
  assert.equal(guestView.questionPacks.every((pack) => !('questions' in pack)), true);
  assert.ok(f.changes.length > 0, 'configuration change requests a room broadcast');
  assert.throws(() => f.store.questionSettings(f.host.roomCode, f.guest.playerId, 'socket-1', 'single', ['builtin-easy-general-knowledge']), /Only the host/);
  f.room.roundSetting = 12;
  f.room.totalRounds = eligibleQuestions(['builtin-easy-general-knowledge']).length + 1;
  f.store.questionSettings(f.host.roomCode, f.host.playerId, 'socket-0', 'single', ['builtin-easy-general-knowledge']);
  assert.throws(() => f.store.start(f.host.roomCode, f.host.playerId, 'socket-0'), /Not enough questions/);
});

test('reconnect restores setup and question secrets remain private until correct reveal', (context) => {
  const f = roomFixture(); context.after(() => f.store.close());
  f.store.questionSettings(f.host.roomCode, f.host.playerId, 'socket-0', 'mixed', ['builtin-easy-science-nature', 'builtin-easy-geography']);
  f.store.reconnect(f.guest, 'socket-new');
  const restored = f.store.view(f.host.roomCode, f.guest.playerId);
  assert.equal(restored.questionMode, 'mixed');
  assert.deepEqual(restored.selectedPackIds, ['builtin-easy-science-nature', 'builtin-easy-geography']);
  f.store.start(f.host.roomCode, f.host.playerId, 'socket-0');
  f.room.question = { ...exampleQuestion };
  let view = f.store.displayView(f.host.roomCode);
  assert.equal(view.correctAnswer, undefined);
  assert.equal(view.explanation, undefined);
  assert.equal(JSON.stringify(view).includes(exampleQuestion.explanation!), false);
  f.room.phase = 'reveal'; f.room.revealStep = 'correct'; f.room.phaseEndsAt = null;
  view = f.store.displayView(f.host.roomCode);
  assert.equal(view.correctAnswer, exampleQuestion.correctAnswer);
  assert.equal(view.explanation, exampleQuestion.explanation);
});

test('accepted genuine answers count as correct and canonicalize into the correct answer card', (context) => {
  const f = roomFixture(); context.after(() => f.store.close());
  f.store.start(f.host.roomCode, f.host.playerId, 'socket-0');
  f.room.question = { ...exampleQuestion };
  f.store.submit(f.host.roomCode, f.host.playerId, 'socket-0', 'answer', 'The Example');
  f.store.submit(f.host.roomCode, f.guest.playerId, 'socket-1', 'answer', 'K2');
  f.store.submit(f.host.roomCode, f.host.playerId, 'socket-0', 'bluff', 'Kangchenjunga');
  f.store.submit(f.host.roomCode, f.guest.playerId, 'socket-1', 'bluff', 'Denali');
  f.store.endDebate(f.host.roomCode, f.host.playerId, 'socket-0');
  f.room.phase = 'vote'; f.room.phaseEndsAt = Date.now() + 1000;
  const correct = f.room.answerPool.find((answer) => answer.isCorrect)!;
  assert.equal(correct.text, exampleQuestion.correctAnswer);
  assert.deepEqual(correct.genuinePlayerIds, [f.host.playerId]);
  f.store.vote(f.host.roomCode, f.host.playerId, 'socket-0', correct.id, false);
  f.store.vote(f.host.roomCode, f.guest.playerId, 'socket-1', correct.id, false);
  assert.equal(f.room.players[0].stats.correctInitialAnswers, 1);
  assert.equal(f.room.players[0].stats.answerChanges, 0);
});

test('Play Again retains pack configuration and a new game reshuffles the sequence', (context) => {
  const f = roomFixture(); context.after(() => f.store.close());
  f.store.settings(f.host.roomCode, f.host.playerId, 'socket-0', 10);
  f.store.questionSettings(f.host.roomCode, f.host.playerId, 'socket-0', 'mixed', ['builtin-easy-general-knowledge', 'builtin-easy-geography']);
  f.store.start(f.host.roomCode, f.host.playerId, 'socket-0');
  const firstOrder = [...f.room.selectedQuestionIds];
  f.room.phase = 'final-results'; f.room.phaseEndsAt = null;
  f.store.reset(f.host.roomCode, f.host.playerId, 'socket-0');
  assert.equal(f.room.questionMode, 'mixed');
  assert.deepEqual(f.room.selectedPackIds, ['builtin-easy-general-knowledge', 'builtin-easy-geography']);
  f.store.start(f.host.roomCode, f.host.playerId, 'socket-0');
  assert.equal(f.room.selectedQuestionIds.length, 10);
  assert.notDeepEqual(f.room.selectedQuestionIds, firstOrder);
});
