'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { clearSession, createSocket, readSession, saveSession, type GameSocket } from '../lib/socket';
import type { Ack, PlayerSession, RoomView } from '../shared/types';

type Action = 'game:start' | 'game:reset' | 'reveal:continue';
interface GameContextValue {
  room: RoomView | null;
  session: PlayerSession | null;
  connected: boolean;
  restoring: boolean;
  pending: boolean;
  error: string;
  enter: (name: string, code?: string) => Promise<PlayerSession | null>;
  leave: () => Promise<boolean>;
  act: (event: Action) => Promise<boolean>;
  submit: (phase: 'answer' | 'bluff', answer: string) => Promise<boolean>;
  vote: (answerId: string, hill: boolean) => Promise<boolean>;
  dismissError: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<GameSocket | null>(null);
  const sessionRef = useRef<PlayerSession | null>(null);
  const busyRef = useRef(false);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [connected, setConnected] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;
    sessionRef.current = readSession();
    setSession(sessionRef.current);
    socket.on('connect', () => {
      setConnected(true);
      const saved = sessionRef.current;
      if (!saved) { setRestoring(false); setError(''); return; }
      setRestoring(true);
      socket.timeout(8000).emit('room:reconnect', saved, (timeout: Error | null, result: Ack<PlayerSession>) => {
        setRestoring(false);
        if (timeout) { setError('Could not restore your room. Refresh to try again.'); return; }
        if (!result.ok) {
          clearSession();
          sessionRef.current = null;
          setSession(null);
          setRoom(null);
          setError(result.error);
        } else setError('');
      });
    });
    socket.on('room:state', setRoom);
    socket.on('disconnect', () => { setConnected(false); });
    socket.on('connect_error', () => { setConnected(false); setRestoring(false); setError('Cannot reach the game server. Reconnecting...'); });
    socket.on('session:replaced', () => {
      clearSession();
      sessionRef.current = null;
      setSession(null);
      setRoom(null);
      setRestoring(false);
      setError('Your player session was opened in another tab. Join with a new name to play here.');
    });
    socket.connect();
    return () => { socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; };
  }, []);

  const request = useCallback(async <T,>(send: (socket: GameSocket, done: (err: Error | null, result: Ack<T>) => void) => void): Promise<Ack<T>> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, error: 'You are disconnected. Wait for the connection to return.' };
    // Never queue phase actions while offline: they might arrive in a later phase.
    if (busyRef.current) return { ok: false, error: 'Please wait for your previous action.' };
    busyRef.current = true;
    setPending(true);
    setError('');
    const result = await new Promise<Ack<T>>((resolve) => send(socket, (err, response) => resolve(err ? { ok: false, error: 'The server did not confirm your action. Check your connection and try again.' } : response)));
    busyRef.current = false;
    setPending(false);
    if (!result.ok) setError(result.error);
    return result;
  }, []);

  const enter = useCallback(async (name: string, code?: string) => {
    const result = await request<PlayerSession>((socket, done) => {
      if (code) socket.timeout(8000).emit('room:join', { name, roomCode: code }, done);
      else socket.timeout(8000).emit('room:create', { name }, done);
    });
    if (!result.ok) return null;
    sessionRef.current = result.data;
    saveSession(result.data);
    setSession(result.data);
    return result.data;
  }, [request]);

  const act = useCallback(async (event: Action) => (await request<undefined>((socket, done) => socket.timeout(8000).emit(event, done))).ok, [request]);
  const submit = useCallback(async (phase: 'answer' | 'bluff', answer: string) => (await request<undefined>((socket, done) => socket.timeout(8000).emit(phase === 'answer' ? 'answer:submit' : 'bluff:submit', { answer }, done))).ok, [request]);
  const vote = useCallback(async (answerId: string, hill: boolean) => (await request<undefined>((socket, done) => socket.timeout(8000).emit('vote:submit', { answerId, hill }, done))).ok, [request]);
  const leave = useCallback(async () => {
    const result = await request<undefined>((socket, done) => socket.timeout(8000).emit('room:leave', done));
    if (!result.ok) return false;
    clearSession();
    sessionRef.current = null;
    setSession(null);
    setRoom(null);
    return true;
  }, [request]);

  return <GameContext.Provider value={{ room, session, connected, restoring, pending, error, enter, leave, act, submit, vote, dismissError: () => setError('') }}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('GameProvider is missing');
  return context;
}
