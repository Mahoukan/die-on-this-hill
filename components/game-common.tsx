'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { RoomView } from '../shared/types';
import { useGame } from './game-provider';

export function Header({ note }: { note?: string }) {
  return <header className="topbar"><Link className="brand-mark" href="/" aria-label="Back to home"><span className="brand-flame" aria-hidden="true">▲</span><span>Die on This Hill</span></Link>{note && <span className="header-note">{note}</span>}</header>;
}

export function RoundStrip({ room }: { room: RoomView }) {
  const me = room.players.find((player) => player.id === room.me.id)!;
  return <div className="round-strip"><span>Round <strong>{room.round}</strong> of {room.totalRounds}</span><span className="score-pill"><strong>{me.score}</strong> pts</span></div>;
}

export function useRemaining(room: RoomView): number {
  const [seconds, setSeconds] = useState(() => room.phaseEndsAt === null ? 0 : Math.max(0, Math.ceil((room.phaseEndsAt - room.serverNow) / 1000)));
  useEffect(() => {
    const offset = room.serverNow - Date.now();
    const tick = () => setSeconds(room.phaseEndsAt === null ? 0 : Math.max(0, Math.ceil((room.phaseEndsAt - Date.now() - offset) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [room.phaseEndsAt, room.serverNow]);
  return seconds;
}

export function Timer({ seconds, label, locked = false }: { seconds: number; label: string; locked?: boolean }) {
  return <div className={`timer${locked ? ' is-stopped' : seconds > 0 && seconds <= 10 ? ' is-urgent' : ''}`} role="timer" aria-label="Time remaining"><span className="timer-value">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span><span className="timer-label">{locked ? 'locked' : seconds === 0 ? 'time’s up' : label}</span></div>;
}

export function GameNotice() {
  const game = useGame();
  if (!game.error && game.connected && !game.restoring) return null;
  return <div className="game-notice" role={game.error ? 'alert' : 'status'}>{game.error || (game.restoring ? 'Restoring your player...' : 'Connection lost. Reconnecting...')}</div>;
}

export function DevStatus({ room }: { room: RoomView }) {
  const game = useGame();
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') console.debug('[Die on This Hill]', { room: room.roomCode, playerId: room.me.id, socket: game.connected ? 'connected' : 'disconnected', phase: room.phase, phaseEndsAt: room.phaseEndsAt });
  }, [room.roomCode, room.me.id, room.phase, room.phaseEndsAt, game.connected]);
  return null;
}

export const signed = (value: number) => value >= 0 ? `+${value}` : String(value);
export const playerName = (room: RoomView, id: string) => room.players.find((player) => player.id === id)?.name || 'Player';
