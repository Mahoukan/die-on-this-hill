import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { GameProvider } from '../components/game-provider';
import { AudioProvider } from '../components/audio-provider';
import { ServiceWorkerRegistration } from '../components/service-worker-registration';
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
import '../css/pwa.css';

export const metadata: Metadata = {
  title: 'Die on This Hill',
  description: "Trivia is easy. Convincing your friends isn't.",
  applicationName: 'Die on This Hill',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Die on This Hill', statusBarStyle: 'black-translucent' },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0c',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><ServiceWorkerRegistration /><AudioProvider><GameProvider>{children}</GameProvider></AudioProvider></body></html>;
}
