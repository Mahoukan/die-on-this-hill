import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { PackRegistry } from '../server/custom-packs';
import { ALL_QUESTIONS, QUESTION_PACKS, selectQuestions } from '../server/questions';
import { loadBuiltInPacks } from '../server/questions/built-in-loader';
import { RoomStore } from '../server/rooms';

function directory(context: TestContext): string {
  const path = mkdtempSync(join(tmpdir(), 'doth-built-ins-'));
  context.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

const sample = { question: 'Which planet?', correctAnswer: ' Jupiter ', category: 'Science', acceptedAnswers: ['Jove', 'Jove'], explanation: '' };
function fixture(context: TestContext): string {
  const path = directory(context);
  for (const difficulty of ['easy', 'medium', 'hard']) {
    mkdirSync(join(path, difficulty));
    writePack(path, difficulty, { name: 'Science', questions: [sample] });
  }
  return path;
}
function writePack(path: string, difficulty: string, pack: unknown, filename = 'science.json'): void {
  writeFileSync(join(path, difficulty, filename), JSON.stringify(pack));
}

test('all 72 source packs join the six originals without changing authored question fields', () => {
  const loaded = loadBuiltInPacks();
  assert.equal(loaded.length, 72);
  assert.equal(QUESTION_PACKS.length, 78);
  assert.equal(ALL_QUESTIONS.length, 4568);
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const folder = join(process.cwd(), 'packs', difficulty);
    assert.equal(readdirSync(folder).filter((file) => file.endsWith('.json')).length, 24);
    for (const file of readdirSync(folder).filter((file) => file.endsWith('.json'))) {
      const raw = JSON.parse(readFileSync(join(folder, file), 'utf8'));
      const id = `builtin-${difficulty}-${file.replace(/\.json$/, '').replaceAll('_', '-')}`;
      const pack = loaded.find((item) => item.id === id)!;
      assert.ok(pack, id);
      assert.equal(pack.custom, false);
      assert.deepEqual(pack.questions.map(({ id: _id, packId: _packId, ...question }) => question),
        raw.questions.map(({ question, text, ...rest }: Record<string, unknown>) => ({ text: text ?? question, ...rest })));
    }
  }
  assert.equal(loaded.find((pack) => pack.id === 'builtin-easy-geography')?.name, 'Geography - Easy');
  assert.equal(loaded.find((pack) => pack.id === 'builtin-medium-entertainment-film')?.name, 'Entertainment Film - Medium');
  assert.deepEqual(loadBuiltInPacks(), loaded, 'reloading preserves every ID');
});

test('IDs depend on source paths and question content, not names, order, or insertions', (context) => {
  const path = fixture(context);
  const original = loadBuiltInPacks(path)[0];
  const second = { ...sample, question: 'Another question?' };
  writePack(path, 'easy', { name: 'Hard - Space - Easy', questions: [second, sample] });
  const changed = loadBuiltInPacks(path)[0];
  assert.equal(changed.id, original.id);
  assert.equal(changed.name, 'Space - Easy');
  assert.equal(changed.questions[1].id, original.questions[0].id);
  assert.equal(changed.questions[1].correctAnswer, ' Jupiter ');
  assert.deepEqual(changed.questions[1].acceptedAnswers, ['Jove', 'Jove']);
  assert.equal(changed.questions[1].explanation, '');
  writePack(path, 'easy', { questions: [sample] });
  assert.equal(loadBuiltInPacks(path)[0].name, 'Science - Easy');
});

test('malformed built-ins fail with the source path and question number', (context) => {
  const path = fixture(context);
  for (const [pack, message] of [
    [{ format: 'wrong', questions: [sample] }, /not a Die on This Hill pack/],
    [{ version: 2, questions: [sample] }, /version is not supported/],
    [{ questions: [] }, /between 1 and 500/],
    [{ questions: Array.from({ length: 501 }, () => sample) }, /between 1 and 500/],
    [{ name: 123, questions: [sample] }, /Pack name is required/],
    [{ questions: [{ ...sample, correctAnswer: '' }] }, /Question 1: Correct answer is required/],
    [{ questions: [{ ...sample, acceptedAnswers: [42] }] }, /Question 1: Accepted answer is required/],
    [{ questions: [sample, sample] }, /Question 2: Identical question/],
  ] as const) {
    writePack(path, 'easy', pack);
    assert.throws(() => loadBuiltInPacks(path), (error: Error) => {
      assert.ok(error.message.includes(join(path, 'easy', 'science.json')));
      assert.match(error.message, message);
      return true;
    });
  }
  writeFileSync(join(path, 'easy', 'science.json'), '{broken');
  assert.throws(() => loadBuiltInPacks(path), /Invalid built-in pack.*science\.json/);
  assert.throws(() => loadBuiltInPacks(join(path, 'missing')), /Cannot load built-in packs/);
});

test('unsafe filenames and slug collisions fail instead of replacing packs', (context) => {
  const path = fixture(context);
  writePack(path, 'easy', { questions: [sample] }, 'science_.json');
  assert.throws(() => loadBuiltInPacks(path), /Duplicate built-in pack ID builtin-easy-science/);
  writePack(path, 'easy', { questions: [sample] }, '---.json');
  assert.throws(() => loadBuiltInPacks(path), /Filename must contain letters or numbers/);
});

test('permanent packs stay out of custom storage, quota, admin listing, and every mutation path', (context) => {
  const path = directory(context);
  const registry = new PackRegistry(path, '0.001');
  const pack = registry.get('builtin-easy-geography')!;
  assert.equal(registry.metadata().find((item) => item.id === pack.id)?.custom, false);
  assert.deepEqual(registry.customPacks(), []);
  assert.equal(registry.storageUsage().usedBytes, 0);
  for (const mutate of [
    () => registry.update(pack.id, 'Changed', ''), () => registry.delete(pack.id),
    () => registry.addQuestion(pack.id, sample),
    () => registry.updateQuestion(pack.id, pack.questions[0].id, sample),
    () => registry.deleteQuestion(pack.id, pack.questions[0].id), () => registry.export(pack.id),
  ]) assert.throws(mutate, /Built-in packs are read-only/);
  registry.reload();
  assert.deepEqual(registry.get(pack.id), pack);
  assert.deepEqual(readdirSync(path), []);
});

test('permanent packs support small-pack availability, mixed selection, and Play Again', (context) => {
  const registry = new PackRegistry(directory(context));
  const store = new RoomStore(() => {}, {}, () => {}, registry);
  context.after(() => store.close());
  const host = store.create('Host', 'socket-0');
  store.join(host.roomCode, 'Guest', 'socket-1');
  const room = store.getRoom(host.roomCode);
  const small = 'builtin-hard-science-gadgets';
  store.questionSettings(host.roomCode, host.playerId, 'socket-0', 'single', [small]);
  assert.equal(store.view(host.roomCode, host.playerId).availableQuestionCount, 5);
  assert.throws(() => store.start(host.roomCode, host.playerId, 'socket-0'), /Not enough questions for 10 rounds/);
  store.settings(host.roomCode, host.playerId, 'socket-0', 5);
  store.start(host.roomCode, host.playerId, 'socket-0');
  assert.equal(new Set(room.selectedQuestionIds).size, 5);
  assert.ok(room.selectedQuestions.every((question) => question.packId === small));
  room.phase = 'final-results'; room.phaseEndsAt = null;
  store.reset(host.roomCode, host.playerId, 'socket-0');
  const ids = [small, 'builtin-easy-geography', 'geography'];
  store.settings(host.roomCode, host.playerId, 'socket-0', 12);
  store.questionSettings(host.roomCode, host.playerId, 'socket-0', 'mixed', ids);
  assert.equal(store.view(host.roomCode, host.playerId).availableQuestionCount, 108);
  assert.equal(registry.eligible([...ids, small]).length, 108);
  const all = selectQuestions(108, ids);
  assert.equal(new Set(all.map((question) => question.id)).size, 108);
  assert.ok(all.every((question) => ids.includes(question.packId)));
  store.start(host.roomCode, host.playerId, 'socket-0');
  const firstOrder = [...room.selectedQuestionIds];
  room.phase = 'final-results'; room.phaseEndsAt = null;
  store.reset(host.roomCode, host.playerId, 'socket-0');
  assert.deepEqual(room.selectedPackIds, ids);
  assert.equal(room.questionMode, 'mixed');
  store.start(host.roomCode, host.playerId, 'socket-0');
  assert.equal(new Set(room.selectedQuestionIds).size, 12);
  assert.notDeepEqual(room.selectedQuestionIds, firstOrder);
});
