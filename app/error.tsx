'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page game-page"><main className="status-shell game-panel"><div className="eyebrow">Application error</div><h1 className="question">Something went wrong.</h1><p className="stage-copy">The page could not be displayed. Your active game may still be running on the server.</p><button className="btn btn-primary" type="button" onClick={reset}>TRY AGAIN</button></main></div>;
}
