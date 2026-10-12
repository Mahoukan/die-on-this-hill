'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuestionMode, RoomView } from '../shared/types';
import { useGame } from './game-provider';
import { GameNotice, Header } from './game-common';

export function Lobby({ room }: { room: RoomView }) {
  const game = useGame();
  const router = useRouter();
  const [copyMessage, setCopyMessage] = useState('Tap the code to copy it.');
  const isHost = room.hostPlayerId === room.me.id;
  const connectedCount = room.players.filter((player) => player.connected).length;
  const roundOptions = ['recommended', 5, 8, 10, 12] as const;
  const insufficient = room.availableQuestionCount < room.totalRounds;
  const selectedPacks = room.questionPacks.filter((pack) => room.selectedPackIds.includes(pack.id));
  const copy = async (link = false) => {
    const value = link ? `${location.origin}/game/${room.roomCode}` : room.roomCode;
    try { await navigator.clipboard.writeText(value); setCopyMessage(link ? 'Invite link copied.' : 'Room code copied.'); }
    catch { setCopyMessage(link ? `Invite: ${value}` : `Room code: ${value}`); }
  };
  const displayUrl = () => `${location.origin}/display/${room.roomCode}`;
  const copyDisplay = async () => {
    try { await navigator.clipboard.writeText(displayUrl()); setCopyMessage('Display link copied.'); }
    catch { setCopyMessage(`Display: ${displayUrl()}`); }
  };
  const setMode = (mode: QuestionMode) => {
    const ids = mode === 'single' ? [room.selectedPackIds[0] || 'general'] : room.questionPacks.map((pack) => pack.id);
    void game.questionSettings(mode, ids);
  };
  const choosePack = (packId: string) => {
    if (room.questionMode === 'single') { void game.questionSettings('single', [packId]); return; }
    const selected = room.selectedPackIds.includes(packId);
    if (selected && room.selectedPackIds.length <= 2) return;
    void game.questionSettings('mixed', selected ? room.selectedPackIds.filter((id) => id !== packId) : [...room.selectedPackIds, packId]);
  };
  return <div className="page page-lobby live-lobby">
    <Header /><GameNotice />
    <main className="lobby-shell">
      <section className="room-panel"><div className="room-kicker">Room code</div><button className="room-code" type="button" onClick={() => void copy()} aria-label={`Copy room code ${room.roomCode}`}>{room.roomCode}</button><p className="copy-message" aria-live="polite">{copyMessage}</p><div className="share-row"><button className="btn btn-secondary btn-small" onClick={() => void copy(true)}>Copy Invite Link</button>{isHost && <><button className="btn btn-secondary btn-small" onClick={() => window.open(`/display/${room.roomCode}`, '_blank', 'noopener,noreferrer')}>Open Shared Display</button><button className="btn btn-ghost btn-small" onClick={() => void copyDisplay()}>Copy Display Link</button></>}</div></section>
      <section className="players-panel" aria-labelledby="players-title"><div className="section-heading"><div><div className="eyebrow">Ready room</div><h1 id="players-title">{connectedCount} {connectedCount === 1 ? 'player' : 'players'} joined</h1></div><div className="status-pill"><span className="status-dot" /> Live</div></div><div className="player-grid">{room.players.map((player) => <article key={player.id} className={`player-card${player.isHost ? ' player-card-host' : ''}${!player.connected ? ' player-card-waiting' : ''}`}><div className="avatar">{Array.from(player.name)[0]}</div><div className="player-info"><strong>{player.name}{player.id === room.me.id ? ' (You)' : ''}</strong><span>{!player.connected ? 'Disconnected' : player.isHost ? 'Host' : 'Ready'}</span></div>{player.connected ? <span className="ready-check" aria-label="Ready">✓</span> : <span className="waiting-dot" aria-label="Disconnected" />}</article>)}</div></section>
      <aside className="settings-card" aria-label="Game settings"><div className="settings-heading"><div><div className="eyebrow">Game setup</div><h2>Tonight&apos;s game</h2></div>{room.roundSetting === 'recommended' && <span className="recommended-badge">Recommended</span>}</div><div className="setting-row rounds-setting"><div><strong>Rounds</strong><span>{room.totalRounds} rounds selected</span></div><div className="segmented" aria-label="Number of rounds">{roundOptions.map((option) => <button type="button" key={option} className={room.roundSetting === option ? 'active' : ''} disabled={!isHost || game.pending || !game.connected} onClick={() => void game.settings(option)}>{option === 'recommended' ? 'Recommended' : option}</button>)}</div></div>{!isHost && <p className="setting-note">Only the host can change game settings.</p>}<div className="setting-row"><div><strong>Questions available</strong><span>Unique questions in this setup</span></div><span className={`optional-label${insufficient ? ' setup-warning-label' : ''}`}>{room.availableQuestionCount}</span></div><div className="setting-row setting-row-compact"><div><strong>Shared display</strong><span>Optional — open /display/{room.roomCode} on a TV</span></div><span className="optional-label">Optional</span></div></aside>
      <section className="pack-settings-panel" aria-labelledby="packs-title"><div className="settings-heading"><div><div className="eyebrow">Question packs</div><h2 id="packs-title">Choose tonight&apos;s topics</h2></div><div className="segmented pack-mode"><button type="button" className={room.questionMode === 'single' ? 'active' : ''} disabled={!isHost || game.pending} onClick={() => setMode('single')}>Single Pack</button><button type="button" className={room.questionMode === 'mixed' ? 'active' : ''} disabled={!isHost || game.pending} onClick={() => setMode('mixed')}>Mixed Game</button></div></div>{isHost ? <div className="pack-grid">{room.questionPacks.map((pack) => { const selected = room.selectedPackIds.includes(pack.id); return <button type="button" key={pack.id} className={`pack-card${selected ? ' is-selected' : ''}`} aria-pressed={selected} disabled={!game.connected || game.pending || (room.questionMode === 'mixed' && selected && room.selectedPackIds.length <= 2)} onClick={() => choosePack(pack.id)}><span className="pack-check" aria-hidden="true">{selected ? '✓' : '+'}</span><strong>{pack.name}</strong><span>{pack.description}</span><small>{pack.questionCount} questions</small></button>; })}</div> : <div className="guest-setup-summary"><strong>{room.totalRounds} rounds · {room.questionMode === 'mixed' ? 'Mixed Game' : 'Single Pack'}</strong><span>{selectedPacks.map((pack) => pack.name).join(' · ')}</span></div>}{insufficient && <div className="setup-warning" role="alert"><strong>Not enough questions for {room.totalRounds} rounds.</strong><span>Choose more question packs or reduce the number of rounds.</span></div>}</section>
      <section className="start-panel">{isHost ? <button className="btn btn-primary btn-large start-button" disabled={!game.connected || game.restoring || game.pending || connectedCount < 2 || insufficient} onClick={() => void game.act('game:start')}>Start {room.totalRounds}-Round Game <span className="btn-arrow" aria-hidden="true">→</span></button> : <p className="lobby-wait" role="status">Waiting for {room.players.find((player) => player.isHost)?.name} to start {room.totalRounds} rounds...</p>}<p>{insufficient ? `Only ${room.availableQuestionCount} questions are available.` : connectedCount < 2 ? 'Invite a friend. You need at least two players.' : `${room.availableQuestionCount} questions available across ${selectedPacks.length} ${selectedPacks.length === 1 ? 'pack' : 'packs'}.`}</p></section>
    </main>
    <footer className="prototype-footer lobby-footer"><button className="text-action" disabled={!game.connected || game.restoring || game.pending} onClick={async () => { if (await game.leave()) router.push('/'); }}>← Leave Game</button><span>No account required</span></footer>
  </div>;
}
