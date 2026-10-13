import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { PackRegistry } from '../server/custom-packs';
import { RoomStore } from '../server/rooms';

const sample = (text = 'Which planet has the shortest day?') => ({ text, correctAnswer: 'Jupiter', category: 'Science', acceptedAnswers: ['The planet Jupiter'], explanation: 'Jupiter rotates in roughly ten hours.' });
function directory(context: TestContext): string { const path = mkdtempSync(join(tmpdir(), 'doth-packs-')); context.after(() => rmSync(path, { recursive: true, force: true })); return path; }

test('custom pack CRUD persists across registry reloads and question IDs stay stable', (context) => {
  const path = directory(context); const registry = new PackRegistry(path);
  let pack = registry.create('Friday Night Chaos', 'Our regular game night');
  assert.match(pack.id, /^custom-friday-night-chaos/); assert.equal(readFileSync(join(path, `${pack.id}.json`), 'utf8').includes('Friday Night Chaos'), true);
  pack = registry.addQuestion(pack.id, sample()); const questionId = pack.questions[0].id;
  pack = registry.updateQuestion(pack.id, questionId, { ...sample(), correctAnswer: 'Jupiter!', category: 'Space' });
  assert.equal(pack.questions[0].id, questionId); assert.equal(pack.questions[0].category, 'Space');
  pack = registry.update(pack.id, 'Friday Chaos', 'Updated');
  const reloaded = new PackRegistry(path).get(pack.id)!; assert.equal(reloaded.name, 'Friday Chaos'); assert.equal(reloaded.questions[0].id, questionId); assert.deepEqual(reloaded.questions[0].acceptedAnswers, ['The planet Jupiter']);
  registry.deleteQuestion(pack.id, questionId); assert.equal(new PackRegistry(path).get(pack.id)!.questions.length, 0);
  registry.delete(pack.id); assert.equal(new PackRegistry(path).get(pack.id), undefined);
});

test('built-ins are immutable, IDs cannot collide, and unsafe paths are rejected', (context) => {
  const registry = new PackRegistry(directory(context));
  assert.throws(() => registry.update('builtin-easy-general-knowledge', 'Changed', ''), /read-only/);
  assert.throws(() => registry.delete('builtin-easy-general-knowledge'), /read-only/);
  assert.throws(() => registry.update('../general', 'Changed', ''), /Invalid custom pack ID/);
  const custom = registry.create('General', 'Name collision is safe'); assert.notEqual(custom.id, 'builtin-easy-general-knowledge'); assert.equal(custom.id.startsWith('custom-'), true);
});

test('import validates before writing, regenerates IDs, avoids overwrite, and export round-trips optional fields', (context) => {
  const path = directory(context); const registry = new PackRegistry(path);
  const json = JSON.stringify({ format: 'die-on-this-hill-pack', version: 1, id: '../../evil', name: 'Friday Night Chaos', description: 'Imported', questions: [{ id: '../../question', ...sample() }] });
  const first = registry.import(json); const second = registry.import(json);
  assert.notEqual(first.id, second.id); assert.equal(second.name, 'Friday Night Chaos (2)'); assert.notEqual(first.questions[0].id, '../../question'); assert.match(first.questions[0].id, new RegExp(`^${first.id}-q-`));
  const exported = registry.export(first.id); assert.equal(exported.filename, 'friday-night-chaos.doth-pack.json'); assert.deepEqual(exported.pack.questions[0].acceptedAnswers, ['The planet Jupiter']); assert.match(exported.pack.questions[0].explanation || '', /roughly ten hours/);
  registry.delete(first.id); const restored = registry.import(JSON.stringify(exported.pack)); assert.equal(restored.name, 'Friday Night Chaos'); assert.deepEqual(restored.questions[0].acceptedAnswers, ['The planet Jupiter']); assert.equal(restored.questions[0].explanation, sample().explanation);
  const before = registry.customPacks().length; assert.throws(() => registry.import('{ nope'), /not valid JSON/); assert.throws(() => registry.import(JSON.stringify({ name: 'Bad' })), /questions array/); assert.throws(() => registry.import(JSON.stringify({ name: 'Bad', questions: [{ text: '', correctAnswer: 'A', category: 'B' }] })), /Question is required/); assert.equal(registry.customPacks().length, before, 'invalid imports are never written');
});

test('duplicates are blocked and corrupted files do not prevent built-in or valid pack loading', (context) => {
  const path = directory(context); const registry = new PackRegistry(path); let pack = registry.create('Safe Pack', ''); pack = registry.addQuestion(pack.id, sample('Same question?'));
  assert.throws(() => registry.addQuestion(pack.id, sample(' SAME   QUESTION!!! ')), /already exists/);
  writeFileSync(join(path, 'custom-broken.json'), '{broken', 'utf8');
  const originalError = console.error; console.error = () => {}; let reloaded: PackRegistry; try { reloaded = new PackRegistry(path); } finally { console.error = originalError; }
  assert.ok(reloaded!.get('builtin-easy-general-knowledge')); assert.ok(reloaded!.get(pack.id)); assert.equal(reloaded!.get('custom-broken'), undefined);
});

test('custom packs integrate with single/mixed setup, live availability, fallback, and active snapshots', (context) => {
  const registry = new PackRegistry(directory(context)); let custom = registry.create('Family Trivia', ''); for (let index = 1; index <= 5; index++) custom = registry.addQuestion(custom.id, sample(`Family question ${index}?`));
  const changes: string[] = []; const store = new RoomStore((code) => changes.push(code), {}, () => {}, registry); context.after(() => store.close());
  const host = store.create('Host', 'socket-0'); store.join(host.roomCode, 'Guest', 'socket-1'); const room = store.getRoom(host.roomCode);
  store.settings(host.roomCode, host.playerId, 'socket-0', 5); store.questionSettings(host.roomCode, host.playerId, 'socket-0', 'single', [custom.id]);
  let view = store.view(host.roomCode, host.playerId); assert.equal(view.availableQuestionCount, 5); assert.equal(view.questionPacks.find((pack) => pack.id === custom.id)?.custom, true);
  store.questionSettings(host.roomCode, host.playerId, 'socket-0', 'mixed', ['builtin-easy-general-knowledge', custom.id]); assert.equal(store.view(host.roomCode, host.playerId).availableQuestionCount, registry.get('builtin-easy-general-knowledge')!.questions.length + 5);
  store.questionSettings(host.roomCode, host.playerId, 'socket-0', 'single', [custom.id]); store.start(host.roomCode, host.playerId, 'socket-0'); const snapshot = room.selectedQuestions.map((question) => ({ ...question }));
  store.deletePackQuestion(custom.id, custom.questions[0].id); assert.deepEqual(room.selectedQuestions, snapshot, 'running game owns immutable question snapshots');
  room.phase = 'final-results'; room.phaseEndsAt = null; store.reset(host.roomCode, host.playerId, 'socket-0'); view = store.view(host.roomCode, host.playerId); assert.equal(view.availableQuestionCount, 4); assert.throws(() => store.start(host.roomCode, host.playerId, 'socket-0'), /Not enough questions/);
  store.deletePack(custom.id); assert.deepEqual(room.selectedPackIds, ['builtin-easy-general-knowledge']); assert.equal(room.questionMode, 'single'); assert.ok(changes.length > 0, 'pack changes broadcast refreshed lobby state');
});
