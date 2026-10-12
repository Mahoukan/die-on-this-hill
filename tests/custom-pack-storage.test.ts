import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientEvents, CustomPackList, QuestionPack, ServerEvents } from '../shared/types';
import { PackRegistry, PackValidationError } from '../server/custom-packs';
import { PackAdminAuth } from '../server/pack-admin';
import { RoomStore } from '../server/rooms';
import { attachGameSockets, type GameServer } from '../server/socket';

const MB = 1024 * 1024;
function directory(context: TestContext): string { const path = mkdtempSync(join(tmpdir(), 'doth-storage-')); context.after(() => rmSync(path, { recursive: true, force: true })); return path; }
function limited(path: string, bytes: number): PackRegistry { return new PackRegistry(path, String(bytes / MB)); }
const question = { text: 'Which planet?', correctAnswer: 'Jupiter', category: 'Science' };

test('runtime storage configuration defaults safely and accepts positive decimal limits', (context) => {
  const path = directory(context);
  const original = process.env.CUSTOM_PACKS_MAX_STORAGE_MB;
  context.after(() => { if (original === undefined) delete process.env.CUSTOM_PACKS_MAX_STORAGE_MB; else process.env.CUSTOM_PACKS_MAX_STORAGE_MB = original; });
  const warning = context.mock.method(console, 'warn', () => {});
  delete process.env.CUSTOM_PACKS_MAX_STORAGE_MB;
  assert.equal(new PackRegistry(path).storageUsage().maxBytes, 100 * MB);
  assert.equal(warning.mock.callCount(), 0);
  process.env.CUSTOM_PACKS_MAX_STORAGE_MB = '2.5';
  assert.equal(new PackRegistry(path).storageUsage().maxBytes, 2.5 * MB);
  const invalid = ['', ' ', 'nope', '100MB', '0', '-1', 'NaN', 'Infinity', '1e309', '1e-309', '9007199254740991', '0x64'];
  for (const value of invalid) assert.equal(new PackRegistry(path, value).storageUsage().maxBytes, 100 * MB, value);
  assert.equal(warning.mock.callCount(), invalid.length);
  assert.deepEqual(warning.mock.calls[0].arguments, ['Invalid CUSTOM_PACKS_MAX_STORAGE_MB; using 100 MB.']);
});

test('quota uses UTF-8 bytes, includes formatting, and permits the exact boundary', (context) => {
  const path = directory(context);
  const registry = new PackRegistry(path, '100');
  const pack = registry.create('Boundary', '\u00e9'.repeat(100));
  const serialized = readFileSync(join(path, `${pack.id}.json`), 'utf8');
  const bytes = Buffer.byteLength(serialized, 'utf8');
  assert.ok(bytes > serialized.length);
  assert.equal(registry.storageUsage().usedBytes, bytes);
  registry.delete(pack.id);
  assert.throws(() => limited(path, bytes - 1).create(pack.name, pack.description), PackValidationError);
  assert.deepEqual(readdirSync(path), []);
  const exact = limited(path, bytes);
  assert.deepEqual(exact.create(pack.name, pack.description), pack);
  assert.equal(exact.storageUsage().usedBytes, bytes);
  assert.throws(() => exact.create('Another', ''), /Custom pack storage is full/);
  assert.throws(() => exact.import(JSON.stringify({ name: 'Imported', questions: [question] })), /Custom pack storage is full/);
  assert.equal(exact.customPacks().length, 1);
  assert.deepEqual(readdirSync(path), [`${pack.id}.json`]);
});

test('replacement subtracts the old file and rejected edits leave disk and memory unchanged', (context) => {
  const path = directory(context);
  const registry = new PackRegistry(path, '100');
  let pack = registry.create('Editing', '');
  pack = registry.addQuestion(pack.id, question);
  const bytes = registry.storageUsage().usedBytes;
  const quota = limited(path, bytes + 10);
  pack = quota.update(pack.id, pack.name, '0123456789');
  assert.equal(quota.storageUsage().usedBytes, bytes + 10, 'growing edit reaches cap without double counting');
  const original = readFileSync(join(path, `${pack.id}.json`));
  for (const edit of [
    () => quota.update(pack.id, `${pack.name} larger`, pack.description),
    () => quota.addQuestion(pack.id, { ...question, text: 'Another planet?' }),
    () => quota.updateQuestion(pack.id, pack.questions[0].id, { ...question, explanation: 'Extra detail' }),
  ]) {
    assert.throws(edit, /Custom pack storage is full/);
    assert.deepEqual(quota.get(pack.id), pack);
    assert.deepEqual(readFileSync(join(path, `${pack.id}.json`)), original);
    assert.deepEqual(readdirSync(path), [`${pack.id}.json`]);
  }
  quota.update(pack.id, pack.name, 'abcdefghij');
  quota.update(pack.id, pack.name, '');
  assert.equal(quota.storageUsage().usedBytes, bytes);
  quota.deleteQuestion(pack.id, pack.questions[0].id);
  assert.ok(quota.storageUsage().usedBytes < bytes);
});

test('usage is scoped to direct JSON files, counts invalid JSON, and ignores temporary files', (context) => {
  const root = directory(context);
  const path = join(root, 'packs');
  const registry = new PackRegistry(path, '100');
  const pack = registry.create('Scoped', '');
  const bytes = registry.storageUsage().usedBytes;
  writeFileSync(join(root, 'outside.json'), 'x'.repeat(1000));
  mkdirSync(join(path, 'nested'));
  writeFileSync(join(path, 'nested', 'ignored.json'), 'x'.repeat(1000));
  writeFileSync(join(path, `${pack.id}.json.abandoned.tmp`), 'x'.repeat(1000));
  writeFileSync(join(path, 'notes.txt'), 'x'.repeat(1000));
  assert.equal(registry.storageUsage().usedBytes, bytes);
  const quota = limited(path, bytes);
  quota.update(pack.id, pack.name, '');
  writeFileSync(join(path, 'custom-invalid.json'), '{bad');
  assert.equal(quota.storageUsage().usedBytes, bytes + 4);
  assert.throws(() => quota.create('Blocked', ''), /Custom pack storage is full/);
});

test('lowering the cap preserves export, shrinking edits, and pack deletion', (context) => {
  const path = directory(context);
  const registry = new PackRegistry(path, '100');
  let pack = registry.create('Over cap', 'Description');
  pack = registry.addQuestion(pack.id, question);
  const quota = limited(path, 1);
  const before = quota.storageUsage().usedBytes;
  assert.equal(quota.export(pack.id).pack.name, pack.name);
  assert.equal(quota.storageUsage().usedBytes, before);
  quota.update(pack.id, pack.name, '');
  quota.deleteQuestion(pack.id, pack.questions[0].id);
  assert.ok(quota.storageUsage().usedBytes < before);
  assert.throws(() => quota.create('Blocked', ''), /Custom pack storage is full/);
  quota.delete(pack.id);
  assert.equal(quota.storageUsage().usedBytes, 0);
});

test('Socket.IO requires admin access and returns usage and a readable quota error', async (context) => {
  const registry = new PackRegistry(directory(context), '1');
  const pack = registry.create('Socket pack', '');
  const packPath = join(registry.directory, `${pack.id}.json`);
  // Valid JSON with trailing whitespace exercises actual disk size and a realistic full quota.
  writeFileSync(packPath, readFileSync(packPath, 'utf8').padEnd(MB, ' '));
  const auth = new PackAdminAuth('test-password', false);
  const http = createServer((request, response) => { void auth.handle(request, response); });
  const server: GameServer = new Server(http);
  const store = new RoomStore(() => {}, {}, () => {}, registry);
  const clients: Socket<ServerEvents, ClientEvents>[] = [];
  context.after(async () => { clients.forEach((client) => client.disconnect()); store.close(); await new Promise<void>((resolve) => server.close(() => resolve())); });
  attachGameSockets(server, store, auth);
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const address = http.address(); assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}`;
  const connect = async (cookie?: string) => {
    const client: Socket<ServerEvents, ClientEvents> = io(url, { forceNew: true, transports: ['websocket'], extraHeaders: cookie ? { Cookie: cookie } : {} });
    clients.push(client);
    await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
    return client;
  };
  const guest = await connect();
  const denied = await new Promise<Ack<CustomPackList>>((resolve) => guest.emit('packs:list', resolve));
  assert.deepEqual(denied, { ok: false, error: 'Admin authorization is required.' });
  const login = await fetch(`${url}/api/pack-admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-password' }) });
  assert.equal(login.status, 200);
  const admin = await connect(login.headers.get('set-cookie')!.split(';')[0]);
  const listing = await new Promise<Ack<CustomPackList>>((resolve) => admin.emit('packs:list', resolve));
  assert.ok(listing.ok);
  assert.deepEqual(listing.data.storage, { usedBytes: MB, maxBytes: MB });
  const rejected = await new Promise<Ack<QuestionPack>>((resolve) => admin.emit('packs:create', { name: 'Too large', description: '' }, resolve));
  assert.deepEqual(rejected, { ok: false, error: 'Custom pack storage is full (1.0 MB / 1 MB). Delete an existing pack before creating, importing, or enlarging a pack.' });
  let changes = 0;
  admin.on('packs:changed', () => { changes++; });
  const deleted = await new Promise<Ack>((resolve) => admin.emit('packs:delete', { packId: pack.id }, resolve));
  assert.ok(deleted.ok);
  const refreshed = await new Promise<Ack<CustomPackList>>((resolve) => admin.emit('packs:list', resolve));
  assert.ok(refreshed.ok);
  assert.deepEqual(refreshed.data.storage, { usedBytes: 0, maxBytes: MB });
  assert.equal(changes, 1);
});
