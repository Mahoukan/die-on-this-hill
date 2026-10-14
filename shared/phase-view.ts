import type { GamePhase, RevealStep } from './types';

export type PhaseView = 'lobby' | 'answer' | 'bluff' | 'debate' | 'vote' | 'reveal' | 'bluff-results' | 'results' | 'final-results';

const PHASE_VIEWS: Record<GamePhase, Exclude<PhaseView, 'bluff-results'>> = {
  lobby: 'lobby',
  answer: 'answer',
  bluff: 'bluff',
  debate: 'debate',
  'debate-transition': 'debate',
  vote: 'vote',
  reveal: 'reveal',
  results: 'results',
  'final-results': 'final-results',
};

export function phaseView(phase: GamePhase, revealStep: RevealStep): PhaseView {
  return phase === 'reveal' && revealStep === 'bluffs' ? 'bluff-results' : PHASE_VIEWS[phase];
}
