import type { Server, Socket } from 'socket.io';
import type { ClientEvents, PlayerSession, Reply, ServerEvents } from '../shared/types';
import { GameError, RoomStore } from './rooms';

interface SocketData { session?: PlayerSession; displayRoomCode?: string }
export type GameServer = Server<ClientEvents, ServerEvents, Record<string, never>, SocketData>;
type GameSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, SocketData>;

export function attachGameSockets(io: GameServer, store: RoomStore): void {
  io.on('connection', (socket: GameSocket) => {
    let requests = 0;
    let windowStart = Date.now();
    const action = <T>(reply: Reply<T>, callback: () => T) => {
      if (typeof reply !== 'function') return;
      if (Date.now() - windowStart >= 1000) { windowStart = Date.now(); requests = 0; }
      if (++requests > 15) { reply({ ok: false, error: 'Too many actions. Try again in a moment.' }); return; }
      try { reply({ ok: true, data: callback() }); }
      catch (error) {
        if (!(error instanceof GameError)) console.error('Game action failed:', error);
        reply({ ok: false, error: error instanceof GameError ? error.message : 'Something went wrong. Please try again.' });
      }
    };
    const session = () => {
      const current = socket.data.session;
      if (!current) throw new GameError('Join a room before taking an action.');
      return current;
    };
    const bind = (identity: PlayerSession) => {
      socket.data.session = identity;
      broadcastRoom(io, store, identity.roomCode);
      return identity;
    };
    const requireUnbound = () => {
      if (socket.data.session || socket.data.displayRoomCode) throw new GameError('This connection is already attached to a room.');
    };
    socket.on('display:join', (payload, reply) => action(reply, () => {
      requireUnbound();
      const view = store.displayView(payload?.roomCode);
      socket.data.displayRoomCode = view.roomCode;
      void socket.join(displayChannel(view.roomCode));
      return view;
    }));
    socket.on('room:create', (payload, reply) => action(reply, () => {
      requireUnbound();
      return bind(store.create(payload?.name, socket.id));
    }));
    socket.on('room:join', (payload, reply) => action(reply, () => {
      requireUnbound();
      return bind(store.join(payload?.roomCode, payload?.name, socket.id));
    }));
    socket.on('room:reconnect', (identity, reply) => action(reply, () => {
      requireUnbound();
      const oldSocket = store.reconnect(identity, socket.id);
      if (oldSocket && oldSocket !== socket.id) {
        const old = io.sockets.sockets.get(oldSocket);
        old?.emit('session:replaced');
        old?.disconnect(true);
      }
      return bind(identity);
    }));
    socket.on('room:leave', (reply) => action(reply, () => {
      const current = session();
      store.disconnect(current.roomCode, current.playerId, socket.id, true);
      socket.data.session = undefined;
      return undefined;
    }));
    socket.on('game:start', (reply) => action(reply, () => {
      const current = session();
      store.start(current.roomCode, current.playerId, socket.id);
      return undefined;
    }));
    socket.on('game:settings', (payload, reply) => action(reply, () => {
      const current = session();
      store.settings(current.roomCode, current.playerId, socket.id, payload?.rounds);
      return undefined;
    }));
    socket.on('game:questions', (payload, reply) => action(reply, () => {
      const current = session();
      store.questionSettings(current.roomCode, current.playerId, socket.id, payload?.mode, payload?.selectedPackIds);
      return undefined;
    }));
    socket.on('game:advance', (reply) => action(reply, () => {
      const current = session();
      store.advanceGame(current.roomCode, current.playerId, socket.id);
      return undefined;
    }));
    socket.on('game:reset', (reply) => action(reply, () => {
      const current = session();
      store.reset(current.roomCode, current.playerId, socket.id);
      return undefined;
    }));
    socket.on('answer:submit', (payload, reply) => action(reply, () => {
      const current = session();
      store.submit(current.roomCode, current.playerId, socket.id, 'answer', payload?.answer);
      return undefined;
    }));
    socket.on('bluff:submit', (payload, reply) => action(reply, () => {
      const current = session();
      store.submit(current.roomCode, current.playerId, socket.id, 'bluff', payload?.answer);
      return undefined;
    }));
    socket.on('vote:submit', (payload, reply) => action(reply, () => {
      const current = session();
      store.vote(current.roomCode, current.playerId, socket.id, payload?.answerId, payload?.hill);
      return undefined;
    }));
    socket.on('debate:set-ready', (payload, reply) => action(reply, () => {
      const current = session();
      store.setDebateReady(current.roomCode, current.playerId, socket.id, payload?.ready);
      return undefined;
    }));
    socket.on('debate:end-host', (reply) => action(reply, () => {
      const current = session();
      store.endDebate(current.roomCode, current.playerId, socket.id);
      return undefined;
    }));
    socket.on('reveal:continue', (reply) => action(reply, () => {
      const current = session();
      store.reveal(current.roomCode, current.playerId, socket.id);
      return undefined;
    }));
    socket.on('disconnect', () => {
      const current = socket.data.session;
      if (current) store.disconnect(current.roomCode, current.playerId, socket.id);
    });
  });
}

export function broadcastRoom(io: GameServer, store: RoomStore, code: string): void {
  for (const player of store.getRoom(code).players) {
    const socketId = store.activeSocket(code, player.id);
    if (socketId) io.to(socketId).emit('room:state', store.view(code, player.id));
  }
  io.to(displayChannel(code)).emit('display:state', store.displayView(code));
}

export const displayChannel = (code: string) => `display:${code}`;
