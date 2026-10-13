import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearSession, readSession, saveSession, SESSION_KEY } from '../lib/socket';
import type { PlayerSession } from '../shared/types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test('reconnect identity persists across reloads and migrates legacy session storage', (context) => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const oldLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const oldSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });
  context.after(() => {
    if (oldLocal) Object.defineProperty(globalThis, 'localStorage', oldLocal); else delete (globalThis as { localStorage?: Storage }).localStorage;
    if (oldSession) Object.defineProperty(globalThis, 'sessionStorage', oldSession); else delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  });

  const identity: PlayerSession = { roomCode: 'ABCD', playerId: 'player-1', reconnectToken: 'secret-token' };
  saveSession(identity);
  assert.deepEqual(JSON.parse(local.getItem(SESSION_KEY)!), identity);
  assert.deepEqual(readSession(), identity);

  clearSession();
  session.setItem(SESSION_KEY, JSON.stringify(identity));
  assert.deepEqual(readSession(), identity);
  assert.deepEqual(JSON.parse(local.getItem(SESSION_KEY)!), identity);
  assert.equal(session.getItem(SESSION_KEY), null);

  clearSession();
  assert.equal(readSession(), null);
});
