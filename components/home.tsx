'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useGame } from './game-provider';

export function Home({ initialCode = '' }: { initialCode?: string }) {
  const game = useGame();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [localError, setLocalError] = useState('');
  const unavailable = !game.connected || game.restoring || game.pending;

  useEffect(() => {
    const invited = new URLSearchParams(location.search).get('room');
    if (invited && !initialCode) setCode(invited.toUpperCase());
  }, [initialCode]);

  const askName = (action: 'create' | 'join') => {
    setLocalError('');
    game.dismissError();
    if (action === 'join' && !/^[A-Z]{4}$/.test(code.trim().toUpperCase())) { setLocalError('Enter a four-letter room code.'); return; }
    setMode(action);
    dialog.current?.showModal();
  };
  const enterRoom = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setLocalError('Enter your display name.'); return; }
    const session = await game.enter(name.trim(), mode === 'join' ? code.trim().toUpperCase() : undefined);
    if (session) { dialog.current?.close(); router.push(`/game/${session.roomCode}`); }
  };

  return <div className="page page-home">
    <main className="home-shell">
      <section className="brand-block" aria-labelledby="game-title"><div className="eyebrow">A party game about being right, or sounding like you are.</div><h1 id="game-title" className="game-title">Die on This Hill</h1><p className="tagline">Trivia is easy. Convincing your friends isn&apos;t.</p></section>
      <section className="home-card" aria-label="Game options">
        {game.session ? <>
          <Link className="btn btn-primary btn-large" href={`/game/${game.session.roomCode}`}>Return to Your Game</Link>
          <button className="btn btn-ghost full-width leave-home" disabled={unavailable} onClick={() => void game.leave()}>Leave Game</button>
        </> : <>
          <button className="btn btn-primary btn-large" type="button" disabled={unavailable} onClick={() => askName('create')}>Create a Game</button>
          <div className="divider" aria-hidden="true"><span>or</span></div>
          <form className="join-form" onSubmit={(event) => { event.preventDefault(); askName('join'); }}>
            <label htmlFor="room-code">Join a Game</label>
            <div className="join-row"><input id="room-code" name="room-code" className="room-input" autoComplete="off" maxLength={4} placeholder="ROOM CODE" aria-describedby="join-help" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setLocalError(''); }} /><button className="btn btn-secondary" disabled={unavailable}>Join</button></div>
            <p id="join-help" className="helper-text">Enter the four-letter code from your friends.</p>
          </form>
        </>}
        <Link className="text-action custom-packs-entry" href="/packs">Manage Custom Packs</Link>
        {(localError || game.error) && <p className="form-error" role="alert">{localError || game.error}</p>}
        {!game.connected && <p className="connection-copy" role="status">Connecting to the game server...</p>}
      </section>
      <section className="how-it-works" aria-label="How the game works">{[['Know it.', 'Give your real answer.'], ['Fake it.', 'Write a believable wrong answer.'], ['Defend it.', 'Argue, bluff, and choose.']].map(([title, copy], index) => <div className="mini-step" key={title}><span className="mini-step-number">{index + 1}</span><div><strong>{title}</strong><span>{copy}</span></div></div>)}</section>
    </main>
    <footer className="site-footer"><span>Play with your friends</span><span>No account required</span></footer>
    <dialog className="name-dialog" ref={dialog} aria-labelledby="name-title" onClose={() => setLocalError('')}>
      <form method="dialog"><button className="dialog-close" aria-label="Close" value="cancel">X</button></form>
      <div className="eyebrow">{mode === 'create' ? 'Your hill awaits' : `Room ${code}`}</div>
      <h2 id="name-title">What should we call you?</h2>
      <form className="answer-form" onSubmit={enterRoom}>
        <label htmlFor="display-name">Display name</label><input id="display-name" className="answer-input" maxLength={24} autoComplete="nickname" required autoFocus value={name} onChange={(event) => { setName(event.target.value); setLocalError(''); }} />
        <p className="input-help">Something your friends will recognise.</p>
        {(localError || game.error) && <p className="form-error" role="alert">{localError || game.error}</p>}
        <button className="btn btn-primary btn-large full-width" disabled={unavailable}>{game.pending ? 'CONNECTING...' : mode === 'create' ? 'CREATE GAME' : 'JOIN GAME'}</button>
      </form>
    </dialog>
  </div>;
}
