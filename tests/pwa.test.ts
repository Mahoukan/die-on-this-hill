import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const origin = 'https://hill.example';
const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

function worker(fetcher: typeof fetch) {
  const handlers = new Map<string, (event: any) => void>();
  const entries = new Map<string, Response>();
  const deleted: string[] = [];
  const added: Request[] = [];
  runInNewContext(source, {
    self: { location: { origin }, addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler) },
    URL, Response,
    Request: class extends Request { constructor(input: string, init?: RequestInit) { super(new URL(input, origin), init); } },
    fetch: fetcher,
    caches: {
      open: async () => ({
        add: async (request: Request) => { added.push(request); entries.set(new URL(request.url).pathname, new Response('Offline notice')); },
        match: async (key: string) => entries.get(key)?.clone(),
      }),
      keys: async () => ['doth-pwa-offline-v0', 'doth-pwa-offline-v1', 'unrelated-cache'],
      delete: async (key: string) => { deleted.push(key); return true; },
    },
  });
  return {
    entries, deleted, added,
    async lifecycle(name: string) {
      let task: Promise<unknown> | undefined;
      handlers.get(name)!({ waitUntil: (promise: Promise<unknown>) => { task = promise; } });
      await task;
    },
    request(path: string, mode = 'navigate', method = 'GET') {
      let result: Promise<Response> | undefined;
      handlers.get('fetch')!({ request: { url: new URL(path, origin).href, mode, method }, respondWith: (promise: Promise<Response>) => { result = promise; } });
      return result;
    },
  };
}

test('service worker only precaches the offline notice and removes its own obsolete caches', async () => {
  const sw = worker(fetch);
  await sw.lifecycle('install');
  assert.deepEqual([...sw.entries.keys()], ['/offline.html']);
  assert.equal(sw.added[0].cache, 'reload');
  await sw.lifecycle('activate');
  assert.deepEqual(sw.deleted, ['doth-pwa-offline-v0']);
});

test('service worker bypasses multiplayer, admin, APIs, RSC, assets and cross-origin requests', () => {
  const sw = worker(async () => { throw new Error('Must not intercept'); });
  for (const path of ['/game/ABCD', '/display/ABCD', '/packs', '/packs/', '/api/health', '/api/pack-admin/session', '/socket.io/?EIO=4&transport=polling', '/_next/static/chunks/app.js', '/icons/icon-192.png', '/audio/gameplay/answer-submit.mp3', 'https://other.example/']) {
    assert.equal(sw.request(path), undefined, path);
  }
  assert.equal(sw.request('/?_rsc=example', 'cors'), undefined);
  assert.equal(sw.request('/', 'navigate', 'POST'), undefined);
});

test('home navigation always uses the network, preserves HTTP errors, and never caches HTML', async () => {
  let status = 200;
  const sw = worker(async (_request, options) => {
    assert.equal(options?.cache, 'no-store');
    return new Response('Live response', { status });
  });
  await sw.lifecycle('install');
  assert.equal(await (await sw.request('/')!).text(), 'Live response');
  status = 503;
  assert.equal((await sw.request('/')!).status, 503);
  assert.deepEqual([...sw.entries.keys()], ['/offline.html']);
});

test('failed home navigation shows the offline notice, including when cache storage was evicted', async () => {
  const sw = worker(async () => { throw new TypeError('Network unavailable'); });
  await sw.lifecycle('install');
  assert.equal(await (await sw.request('/')!).text(), 'Offline notice');
  sw.entries.clear();
  const response = await sw.request('/')!;
  assert.equal(response.status, 503);
  assert.match(await response.text(), /requires an internet connection to play/);
});
