import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GameProvider } from '../components/game-provider';
import { AudioProvider } from '../components/audio-provider';
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
import '../css/final-results.css';
import '../css/display.css';
import './multiplayer.css';
import '../css/animations.css';

export const metadata: Metadata = {
  title: 'Die on This Hill',
  description: "Trivia is easy. Convincing your friends isn't.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><AudioProvider><GameProvider>{children}</GameProvider></AudioProvider></body></html>;
}
