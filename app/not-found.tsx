import Link from 'next/link';

export default function NotFound() {
  return <div className="page game-page"><main className="status-shell game-panel"><div className="eyebrow">Page not found</div><h1 className="question">This hill does not exist.</h1><p className="stage-copy">Check the address or return home to create or join a game.</p><Link className="btn btn-primary" href="/">BACK TO HOME</Link></main></div>;
}
