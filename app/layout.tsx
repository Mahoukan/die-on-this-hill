import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GameProvider } from '../components/game-provider';
import '../css/base.css';
import '../css/home.css';
import '../css/lobby.css';
import '../css/answer.css';
import '../css/bluff.css';
import '../css/debate.css';
import '../css/vote.css';
import '../css/reveal.css';
import '../css/bluff-results.css';
import '../css/results.css';
import './multiplayer.css';

export const metadata: Metadata = {
  title: 'Die on This Hill',
  description: "Trivia is easy. Convincing your friends isn't.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><GameProvider>{children}</GameProvider></body></html>;
}
