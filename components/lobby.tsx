'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RoomView } from '../shared/types';
import { useGame } from './game-provider';
import { GameNotice, Header } from './game-common';

export function Lobby({ room }: { room: RoomView }) {
  const game = useGame();
  const router = useRouter();
  const [copyMessage, setCopyMessage] = useState('Tap the code to copy it.');
  const isHost = room.hostPlayerId === room.me.id;
  const connectedCount = room.players.filter((player) => player.connected).length;
  const copy = async (link = false) => {
    const text = link ? `${location.origin}/game/${room.roomCode}` : room.roomCode;
    try { await navigator.clipboard.writeText(text); setCopyMessage(link ? 'Invite link copied.' : 'Room code copied.'); }
    catch { setCopyMessage(link ? `Invite: ${text}` : `Room code: ${text}`); }
  };
  return <div className="page page-lobby live-lobby">
    <Header />
    <GameNotice />
    <main className="lobby-shell">
      <section className="room-panel"><div className="room-kicker">Room code</div><button className="room-code" type="button" onClick={() => void copy()} aria-label={`Copy room code ${room.roomCode}`}>{room.roomCode}</button><p className="copy-message" aria-live="polite">{copyMessage}</p><div className="share-row"><button className="btn btn-secondary btn-small" onClick={() => void copy(true)}>Copy Invite Link</button><button className="btn btn-ghost btn-small" disabled>Shared Display · Coming Later</button></div></section>
      <section className="players-panel" aria-labelledby="players-title"><div className="section-heading"><div><div className="eyebrow">Ready room</div><h1 id="players-title">{connectedCount} {connectedCount === 1 ? 'player' : 'players'} joined</h1></div><div className="status-pill"><span className="status-dot" /> Live</div></div>
        <div className="player-grid">{room.players.map((player) => <article key={player.id} className={`player-card${player.isHost ? ' player-card-host' : ''}${!player.connected ? ' player-card-waiting' : ''}`}><div className="avatar">{Array.from(player.name)[0]}</div><div className="player-info"><strong>{player.name}{player.id === room.me.id ? ' (You)' : ''}</strong><span>{!player.connected ? 'Disconnected' : player.isHost ? 'Host' : 'Ready'}</span></div>{player.connected ? <span className="ready-check" aria-label="Ready">✓</span> : <span className="waiting-dot" aria-label="Disconnected" />}</article>)}</div>
      </section>
      <aside className="settings-card" aria-label="Game settings"><div className="settings-heading"><div><div className="eyebrow">Game setup</div><h2>Tonight&apos;s game</h2></div><span className="recommended-badge">Recommended</span></div><div className="setting-row"><div><strong>Rounds</strong><span>One complete round</span></div><div className="segmented"><button type="button" className="active" disabled>1</button></div></div><div className="setting-row"><div><strong>Question</strong><span>Ready to play</span></div><span className="optional-label">Mixed Trivia</span></div><div className="setting-row setting-row-compact"><div><strong>Shared display</strong><span>Optional — the whole game works without it</span></div><span className="optional-label">Optional</span></div></aside>
      <section className="start-panel">{isHost ? <button className="btn btn-primary btn-large start-button" disabled={!game.connected || game.restoring || game.pending || connectedCount < 2} onClick={() => void game.act('game:start')}>Start Game <span className="btn-arrow" aria-hidden="true">→</span></button> : <p className="lobby-wait" role="status">Waiting for {room.players.find((player) => player.isHost)?.name} to start...</p>}<p>{connectedCount < 2 ? 'Invite a friend. You need at least two players.' : 'Everyone can play entirely from their own device.'}</p></section>
    </main>
    <footer className="prototype-footer lobby-footer"><button className="text-action" disabled={!game.connected || game.restoring || game.pending} onClick={async () => { if (await game.leave()) router.push('/'); }}>← Leave Game</button><span>No account required</span></footer>
  </div>;
}
