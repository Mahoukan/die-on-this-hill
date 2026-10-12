import { io, type Socket } from 'socket.io-client';
import type { ClientEvents, PlayerSession, ServerEvents } from '../shared/types';

export type GameSocket = Socket<ServerEvents, ClientEvents>;
export const SESSION_KEY = 'doth-multiplayer-session';

export function createSocket(): GameSocket { return io({ autoConnect: false }); }

export function readSession(): PlayerSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return value && typeof value.roomCode === 'string' && typeof value.playerId === 'string' && typeof value.reconnectToken === 'string' ? value : null;
  } catch { return null; }
}

export function saveSession(session: PlayerSession): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  catch { /* The open connection still works if browser storage is restricted. */ }
}

export function clearSession(): void { try { sessionStorage.removeItem(SESSION_KEY); } catch { } }

