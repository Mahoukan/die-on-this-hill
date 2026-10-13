import { io, type Socket } from 'socket.io-client';
import type { ClientEvents, PlayerSession, ServerEvents } from '../shared/types';

export type GameSocket = Socket<ServerEvents, ClientEvents>;
export const SESSION_KEY = 'doth-multiplayer-session';

export function createSocket(): GameSocket { return io({ autoConnect: false }); }

function parseSession(stored: string | null): PlayerSession | null {
  try {
    const value = JSON.parse(stored || 'null');
    return value && typeof value.roomCode === 'string' && typeof value.playerId === 'string' && typeof value.reconnectToken === 'string' ? value as PlayerSession : null;
  } catch { return null; }
}

export function readSession(): PlayerSession | null {
  let local: PlayerSession | null = null;
  let legacy: PlayerSession | null = null;
  try { local = parseSession(localStorage.getItem(SESSION_KEY)); } catch { }
  if (!local) try { legacy = parseSession(sessionStorage.getItem(SESSION_KEY)); } catch { }
  const saved = local || legacy;
  if (saved) saveSession(saved);
  return saved;
}

export function saveSession(session: PlayerSession): void {
  const value = JSON.stringify(session);
  try { localStorage.setItem(SESSION_KEY, value); sessionStorage.removeItem(SESSION_KEY); return; }
  catch { /* Fall back for browsers that restrict persistent storage. */ }
  try { sessionStorage.setItem(SESSION_KEY, value); } catch { /* The open connection still works if browser storage is restricted. */ }
}

export function clearSession(): void { try { localStorage.removeItem(SESSION_KEY); } catch { } try { sessionStorage.removeItem(SESSION_KEY); } catch { } }

