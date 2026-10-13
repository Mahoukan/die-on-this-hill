import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PackSelector } from '../components/pack-selector';
import { PackRegistry } from '../server/custom-packs';
import { QUESTION_PACK_METADATA } from '../server/questions';
import { RoomStore } from '../server/rooms';
import { groupQuestionPacks, selectPackGroup } from '../shared/pack-selection';

function fixture(context: TestContext) {
  const path = mkdtempSync(join(tmpdir(), 'doth-selection-'));
  const registry = new PackRegistry(path);
  const custom = registry.create('Hard - Custom quiz', '');
  const store = new RoomStore(() => {}, {}, () => {}, registry);
  context.after(() => { store.close(); rmSync(path, { recursive: true, force: true }); });
  const host = store.create('Host', 'host');
  const guest = store.join(host.roomCode, 'Guest', 'guest');
  const view = () => store.view(host.roomCode, guest.playerId);
  const update = (ids: string[]) => store.questionSettings(host.roomCode, host.playerId, 'host', 'mixed', ids);
  return { store, host, guest, custom, view, update, packs: registry.metadata() };
}

test('groups use folder metadata regardless of names, with custom packs separate', (context) => {
  const f = fixture(context);
  const groups = groupQuestionPacks(f.packs.map((pack) => ({ ...pack, name: 'Misleading - Hard' })));
  assert.deepEqual(groups.map(({ id, packs }) => [id, packs.length]), [['easy', 24], ['medium', 24], ['hard', 24], ['custom', 1]]);
  assert.deepEqual(groups[3].packs.map((pack) => pack.id), [f.custom.id]);
  assert.equal(groupQuestionPacks(QUESTION_PACK_METADATA).some((group) => group.id === 'custom'), false);
});

test('global select all and deselect all synchronize through the server, including custom packs', (context) => {
  const f = fixture(context);
  f.update(selectPackGroup(f.view().selectedPackIds, f.packs, true));
  assert.deepEqual(new Set(f.view().selectedPackIds), new Set(f.packs.map((pack) => pack.id)));
  assert.equal(f.view().availableQuestionCount, 4496);
  f.update(selectPackGroup(f.view().selectedPackIds, f.packs, true));
  assert.equal(f.view().selectedPackIds.length, 73, 'repeated selection has no duplicates');
  f.update(selectPackGroup(f.view().selectedPackIds, f.packs, false));
  assert.deepEqual(f.view().selectedPackIds, []);
  assert.equal(f.view().questionMode, 'mixed');
  assert.equal(f.view().availableQuestionCount, 0);
  f.store.createPack('Unrelated custom pack', '');
  f.store.reconnect(f.guest, 'guest-new');
  assert.deepEqual(f.view().selectedPackIds, [], 'registry changes and reconnect never refill an empty selection');
});

test('difficulty and custom group actions leave every other group unchanged', (context) => {
  const f = fixture(context);
  const groups = groupQuestionPacks(f.packs);
  for (const group of groups) {
    const outside = f.packs.filter((pack) => !group.packs.some((item) => item.id === pack.id)).map((pack) => pack.id);
    f.update(outside);
    f.update(selectPackGroup(f.view().selectedPackIds, group.packs, true));
    assert.equal(f.view().selectedPackIds.length, f.packs.length);
    f.update(selectPackGroup(f.view().selectedPackIds, group.packs, false));
    assert.deepEqual(f.view().selectedPackIds, outside);
  }
});

test('Mixed Game accepts incomplete setup but requires two distinct packs to start', (context) => {
  const f = fixture(context);
  const ids = ['builtin-easy-general-knowledge', 'builtin-easy-geography'];
  for (const selection of [[], [ids[0]], [ids[0], ids[0]]]) {
    f.update(selection);
    assert.throws(() => f.store.start(f.host.roomCode, f.host.playerId, 'host'), /at least two packs/);
    assert.equal(f.view().phase, 'lobby');
  }
  assert.throws(() => f.update(['missing-pack']), /do not exist/);
  assert.throws(() => f.store.questionSettings(f.host.roomCode, f.guest.playerId, 'guest', 'mixed', []), /Only the host/);
  assert.throws(() => f.store.questionSettings(f.host.roomCode, f.host.playerId, 'host', 'single', []), /Choose one/);
  f.update(ids);
  f.store.start(f.host.roomCode, f.host.playerId, 'host');
  assert.equal(f.view().phase, 'answer');
});

test('deleting a selected custom pack preserves incomplete Mixed Game setup', (context) => {
  const f = fixture(context);
  f.update(['builtin-easy-geography', f.custom.id]);
  f.store.deletePack(f.custom.id);
  assert.equal(f.view().questionMode, 'mixed');
  assert.deepEqual(f.view().selectedPackIds, ['builtin-easy-geography']);
  assert.throws(() => f.store.start(f.host.roomCode, f.host.playerId, 'host'), /at least two packs/);
});

test('selector renders accessible expanded groups, selection summaries, and Mixed Game-only actions', () => {
  const easyIds = QUESTION_PACK_METADATA.filter((pack) => pack.difficulty === 'easy').map((pack) => pack.id);
  const render = (mode: 'single' | 'mixed') => renderToStaticMarkup(createElement(PackSelector, {
    packs: QUESTION_PACK_METADATA, selectedIds: [...easyIds, 'builtin-medium-geography'], mode, disabled: false, onChange: () => {},
  }));
  const mixed = render('mixed');
  assert.equal((mixed.match(/aria-expanded="true"/g) ?? []).length, 3);
  assert.equal((mixed.match(/aria-controls=/g) ?? []).length, 3);
  assert.equal((mixed.match(/>Select All<\/button>/g) ?? []).length, 4);
  assert.equal((mixed.match(/>Deselect All<\/button>/g) ?? []).length, 4);
  for (const label of ['All selected', 'Some selected', 'None selected']) assert.ok(mixed.includes(label));
  const single = render('single');
  assert.equal(single.includes('Select All'), false);
  assert.equal(single.includes('Deselect All'), false);
  assert.equal(single.includes('Custom Packs'), false);
});
