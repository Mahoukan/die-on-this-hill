import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientEvents, DisplayView, PlayerSession, ServerEvents } from '../shared/types';
import { RoomStore } from '../server/rooms';
import { attachGameSockets, broadcastRoom, type GameServer } from '../server/socket';

function fixture(count: number, durations = { answer: 1000, bluff: 1000, debate: 1000, 'debate-transition': 20, vote: 1000 }) {
  const store = new RoomStore(() => {}, durations);
  const host = store.create('Player 1', 'socket-0');
  const sessions = [host, ...Array.from({ length: count - 1 }, (_, index) => store.join(host.roomCode, `Player ${index + 2}`, `socket-${index + 1}`))];
  const send = (index: number, phase: 'answer' | 'bluff', answer: string) => store.submit(host.roomCode, sessions[index].playerId, `socket-${index}`, phase, answer);
  return { store, host, sessions, send, code: host.roomCode };
}

function reachDebate(f: ReturnType<typeof fixture>) {
  f.store.start(f.code, f.host.playerId, 'socket-0');
  const correct = f.store.getRoom(f.code).question!.correctAnswer;
  f.sessions.forEach((_, index) => f.send(index, 'answer', index === 0 ? correct : `Wrong ${index}`));
  f.sessions.forEach((_, index) => f.send(index, 'bluff', `Bluff ${index}`));
  assert.equal(f.store.getRoom(f.code).phase, 'debate');
}

test('strict-majority thresholds are correct for 3, 4, and 5 connected players', (context) => {
  const fixtures = [fixture(3), fixture(4), fixture(5)];
  context.after(() => fixtures.forEach((item) => item.store.close()));
  const expected = [2, 3, 3];
  fixtures.forEach((item, index) => { reachDebate(item); assert.equal(item.store.displayView(item.code).debateRequiredCount, expected[index]); });
});

test('readiness toggles off before majority, majority starts transition, and changes then lock', async (context) => {
  const f = fixture(3); context.after(() => f.store.close()); reachDebate(f);
  f.store.setDebateReady(f.code, f.sessions[0].playerId, 'socket-0', true);
  assert.equal(f.store.view(f.code, f.sessions[0].playerId).me.debateReady, true);
  assert.equal(f.store.displayView(f.code).debateReadyCount, 1);
  f.store.setDebateReady(f.code, f.sessions[0].playerId, 'socket-0', false);
  assert.equal(f.store.displayView(f.code).debateReadyCount, 0);
  f.store.setDebateReady(f.code, f.sessions[0].playerId, 'socket-0', true);
  f.store.setDebateReady(f.code, f.sessions[1].playerId, 'socket-1', true);
  const room = f.store.getRoom(f.code);
  assert.equal(room.phase, 'debate-transition');
  assert.ok(room.phaseEndsAt && room.phaseEndsAt > Date.now());
  assert.throws(() => f.store.setDebateReady(f.code, f.sessions[2].playerId, 'socket-2', true), /phase has ended/);
  await delay(30);
  assert.equal(room.phase, 'vote');
  assert.deepEqual(room.debateReadyPlayerIds, []);
});

test('host override uses the transition while a non-host is rejected', async (context) => {
  const f = fixture(3); context.after(() => f.store.close()); reachDebate(f);
  assert.throws(() => f.store.endDebate(f.code, f.sessions[1].playerId, 'socket-1'), /Only the host/);
  f.store.endDebate(f.code, f.host.playerId, 'socket-0');
  assert.equal(f.store.getRoom(f.code).phase, 'debate-transition');
  assert.throws(() => f.store.endDebate(f.code, f.host.playerId, 'socket-0'), /phase has ended/);
  await delay(30);
  assert.equal(f.store.getRoom(f.code).phase, 'vote');
});

test('natural debate expiry advances directly and a timer/readiness race cannot advance twice', async (context) => {
  const f = fixture(3, { answer: 1000, bluff: 1000, debate: 8, 'debate-transition': 30, vote: 200 }); context.after(() => f.store.close()); reachDebate(f);
  await delay(12);
  assert.throws(() => f.store.setDebateReady(f.code, f.sessions[0].playerId, 'socket-0', true), /phase has ended/);
  assert.equal(f.store.getRoom(f.code).phase, 'vote');
  await delay(40);
  assert.equal(f.store.getRoom(f.code).phase, 'vote', 'stale debate or transition timers cannot advance the vote phase');
});

test('readiness resets for the next round and Play Again', async (context) => {
  const f = fixture(3); context.after(() => f.store.close()); reachDebate(f);
  f.store.setDebateReady(f.code, f.sessions[0].playerId, 'socket-0', true);
  f.store.setDebateReady(f.code, f.sessions[1].playerId, 'socket-1', true);
  await delay(30);
  const room = f.store.getRoom(f.code);
  const firstAnswer = room.answerPool[0].id;
  f.sessions.forEach((session, index) => f.store.vote(f.code, session.playerId, `socket-${index}`, firstAnswer, false));
  for (let step = 0; step < 4; step++) f.store.reveal(f.code, f.host.playerId, 'socket-0');
  f.store.advanceGame(f.code, f.host.playerId, 'socket-0');
  assert.deepEqual(room.debateReadyPlayerIds, []);
  room.phase = 'final-results';
  room.debateReadyPlayerIds = [f.host.playerId];
  f.store.reset(f.code, f.host.playerId, 'socket-0');
  assert.deepEqual(room.debateReadyPlayerIds, []);
});

test('player reconnect restores their debate readiness', (context) => {
  const f = fixture(3); context.after(() => f.store.close()); reachDebate(f);
  f.store.setDebateReady(f.code, f.sessions[1].playerId, 'socket-1', true);
  f.store.disconnect(f.code, f.sessions[1].playerId, 'socket-1');
  f.store.reconnect(f.sessions[1], 'socket-new');
  const view = f.store.view(f.code, f.sessions[1].playerId);
  assert.equal(view.me.debateReady, true);
  assert.equal(view.debateReadyCount, 1);
});

test('display sockets are read-only, do not count as players, preserve privacy, and restore transitions', async (context) => {
  const http = createServer();
  const server: GameServer = new Server(http);
  const store = new RoomStore((code) => broadcastRoom(server, store, code), { answer: 1000, bluff: 1000, debate: 1000, 'debate-transition': 80, vote: 1000 });
  attachGameSockets(server, store);
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const address = http.address(); assert.ok(address && typeof address === 'object'); const url = `http://127.0.0.1:${address.port}`;
  const clients: Socket<ServerEvents, ClientEvents>[] = [];
  context.after(async () => { clients.forEach((client) => client.disconnect()); store.close(); await new Promise<void>((resolve) => server.close(() => resolve())); });
  const connect = async () => { const client: Socket<ServerEvents, ClientEvents> = io(url, { forceNew: true, transports: ['websocket'] }); clients.push(client); await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); }); return client; };
  const players = await Promise.all([connect(), connect(), connect()]);
  const created = await new Promise<Ack<PlayerSession>>((resolve) => players[0].emit('room:create', { name: 'Host' }, resolve)); assert.ok(created.ok);
  for (let index = 1; index < 3; index++) { const joined = await new Promise<Ack<PlayerSession>>((resolve) => players[index].emit('room:join', { roomCode: created.data.roomCode, name: `Guest ${index}` }, resolve)); assert.ok(joined.ok); }
  const display = await connect(); let displayState: DisplayView | undefined; display.on('display:state', (state) => { displayState = state; });
  const displayJoin = await new Promise<Ack<DisplayView>>((resolve) => display.emit('display:join', { roomCode: created.data.roomCode.toLowerCase() }, resolve)); assert.ok(displayJoin.ok);
  assert.equal(displayJoin.data.roomCode, created.data.roomCode);
  assert.equal(store.getRoom(created.data.roomCode).players.length, 3);
  assert.equal(displayJoin.data.debateRequiredCount, 2);
  const forbidden = await new Promise<Ack>((resolve) => display.emit('debate:set-ready', { ready: true }, resolve)); assert.equal(forbidden.ok, false);

  await new Promise<Ack>((resolve) => players[0].emit('game:start', resolve));
  await new Promise<Ack>((resolve) => players[0].emit('answer:submit', { answer: 'Ultra Secret Guess' }, resolve));
  await delay(10);
  assert.ok(displayState);
  assert.equal(JSON.stringify(displayState).includes('Ultra Secret Guess'), false);
  assert.equal(displayState.correctAnswer, undefined);
  assert.equal('me' in displayState, false);
  for (let index = 1; index < 3; index++) await new Promise<Ack>((resolve) => players[index].emit('answer:submit', { answer: `Wrong ${index}` }, resolve));
  for (let index = 0; index < 3; index++) await new Promise<Ack>((resolve) => players[index].emit('bluff:submit', { answer: `Bluff ${index}` }, resolve));
  await delay(10);
  assert.equal(displayState?.phase, 'debate');
  assert.equal(displayState?.answerPool.every((answer) => Object.keys(answer).sort().join(',') === 'id,text'), true);
  await new Promise<Ack>((resolve) => players[0].emit('debate:set-ready', { ready: true }, resolve));
  await new Promise<Ack>((resolve) => players[1].emit('debate:set-ready', { ready: true }, resolve));
  await delay(10);
  assert.equal(displayState?.phase, 'debate-transition');
  const deadline = displayState?.phaseEndsAt;
  const refreshedDisplay = await connect();
  const restored = await new Promise<Ack<DisplayView>>((resolve) => refreshedDisplay.emit('display:join', { roomCode: created.data.roomCode }, resolve)); assert.ok(restored.ok);
  assert.equal(restored.data.phase, 'debate-transition');
  assert.equal(restored.data.phaseEndsAt, deadline);
  assert.equal(restored.data.players.length, 3);
  assert.equal(restored.data.correctAnswer, undefined);
  assert.equal(restored.data.answerPool.every((answer) => Object.keys(answer).sort().join(',') === 'id,text'), true);
});
