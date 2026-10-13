'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { RoomView } from '../shared/types';
import { useGame } from './game-provider';
import { AudioSettingsControl } from './audio-provider';

export function Header({ note, roomCode }: { note?: string; roomCode?: string }) {
  return <header className="topbar"><Link className="brand-mark" href="/" aria-label="Back to home"><span className="brand-flame" aria-hidden="true" /><span>Die on This Hill</span></Link>{note && <span className="header-note">{note}</span>}<AudioSettingsControl compact />{roomCode && <DisplayMenu roomCode={roomCode} />}</header>;
}

function DisplayMenu({ roomCode }: { roomCode: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const path = `/display/${roomCode}`;
  const copy = async () => { const url = `${location.origin}${path}`; try { await navigator.clipboard.writeText(url); setMessage('Display link copied'); } catch { setMessage(url); } };
  return <div className="display-menu"><button type="button" className="display-menu-trigger" aria-expanded={open} onClick={() => setOpen(!open)}>DISPLAY</button>{open && <div className="display-menu-panel"><strong>Shared Display</strong><p>Open a read-only game display on another screen, TV, tablet or browser.</p><button className="btn btn-secondary btn-small" type="button" onClick={() => window.open(path, '_blank', 'noopener,noreferrer')}>Open Display</button><button className="btn btn-ghost btn-small" type="button" onClick={() => void copy()}>Copy Display Link</button>{message && <span role="status">{message}</span>}</div>}</div>;
}

export function RoundStrip({ room }: { room: RoomView }) {
  const me = room.players.find((player) => player.id === room.me.id)!;
  return <div className="round-strip"><span>Round <strong>{room.round}</strong> of {room.totalRounds}</span><span className="score-pill"><strong>{me.score}</strong> pts</span></div>;
}

export function useRemaining(room: Pick<RoomView, 'phaseEndsAt' | 'serverNow'>): number {
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

export function HostSkip({ room, label = 'SKIP TIMER' }: { room: RoomView; label?: string }) {
  const game = useGame();
  if (room.hostPlayerId !== room.me.id) return null;
  return <div className="host-phase-controls"><span className="eyebrow">Host controls</span><button className="btn btn-secondary" type="button" disabled={!game.connected || game.restoring || game.pending || room.phaseEndsAt === null} onClick={() => void game.skipPhase()}>{game.pending ? 'SKIPPING...' : label}</button></div>;
}

export function GameNotice() {
  const game = useGame();
  const wasDisconnected = useRef(false); const [restored, setRestored] = useState(false);
  useEffect(() => { if (!game.connected) { wasDisconnected.current = true; setRestored(false); return; } if (!wasDisconnected.current || game.restoring) return; wasDisconnected.current = false; setRestored(true); const timer = window.setTimeout(() => setRestored(false), 1800); return () => window.clearTimeout(timer); }, [game.connected, game.restoring]);
  if (!game.error && game.connected && !game.restoring && !restored) return null;
  return <div className={`game-notice${restored ? ' is-restored' : ''}`} role={game.error ? 'alert' : 'status'}>{game.error || (restored ? 'RECONNECTED' : game.restoring ? 'Restoring your player...' : 'RECONNECTING...')}</div>;
}

export const signed = (value: number) => value >= 0 ? `+${value}` : String(value);
export const playerName = (room: RoomView, id: string) => room.players.find((player) => player.id === id)?.name || 'Player';
