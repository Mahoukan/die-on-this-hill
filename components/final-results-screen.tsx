'use client';

import { useRouter } from 'next/navigation';
import type { RoomView } from '../shared/types';
import { useGame } from './game-provider';
import { playerName } from './game-common';

export function FinalResultsScreen({ room }: { room: RoomView }) {
  const game = useGame();
  const router = useRouter();
  const hostName = playerName(room, room.hostPlayerId);
  const leave = async () => { if (await game.leave()) router.push('/'); };
  return <main className="game-shell game-shell-wide">
    <section className="final-heading" aria-labelledby="final-title"><div className="eyebrow">Game over · The last ones standing</div><h1 id="final-title">THE HILL HAS CLAIMED ITS VICTIMS</h1><p>The scores are final. The arguments probably aren’t.</p></section>
    <div className="final-layout">
      <section className="rankings-panel" aria-labelledby="rankings-title"><h2 id="rankings-title" className="eyebrow">Final rankings</h2><ol className="final-rankings">{room.leaderboard.map((entry) => <li key={entry.playerId} className={entry.rank === 1 ? 'champion' : ''}><span className="rank-number">{entry.rank}</span><div className="rank-player"><strong>{playerName(room, entry.playerId)}{entry.playerId === room.me.id ? ' (You)' : ''}</strong>{entry.rank === 1 && <span>King of the hill</span>}{entry.hillSuccessful && <span className="hill-lived">▲ Died on the Hill and lived</span>}</div><strong className={`rank-score${entry.score < 0 ? ' negative' : ''}`}>{entry.score.toLocaleString()}</strong></li>)}</ol></section>
      <section className="awards-section" aria-labelledby="awards-title"><h2 id="awards-title" className="eyebrow">Glory, shame & honourable mentions</h2><div className="awards-grid">{room.awards.map((award, index) => <article className={`award-card${room.awards.length % 2 === 1 && index === room.awards.length - 1 ? ' award-wide' : ''}`} key={award.key}><span className="award-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h3>{award.title}</h3><p>{award.description}</p><div className="award-winner"><span>{award.valueLabel}</span><strong>{award.winnerIds.map((id) => playerName(room, id)).join(' & ')}</strong></div></article>)}</div>{room.awards.length === 0 && <p className="phase-note">No awards this time. A remarkably restrained game.</p>}</section>
    </div>
    <div className="page-actions final-actions">{room.hostPlayerId === room.me.id ? <button className="btn btn-primary btn-large" disabled={!game.connected || game.restoring || game.pending} onClick={() => void game.act('game:reset')}>PLAY AGAIN →</button> : <p className="phase-note" role="status">Waiting for {hostName} to choose Play Again.</p>}<button className="btn btn-secondary btn-large" disabled={!game.connected || game.restoring || game.pending} onClick={() => void leave()}>BACK TO HOME</button></div>
  </main>;
}
