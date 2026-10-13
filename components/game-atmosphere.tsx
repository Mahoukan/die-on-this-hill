'use client';

import { useEffect, useRef } from 'react';
import type { RoomView } from '../shared/types';
import { useAudio } from './audio-provider';
import { playerName } from './game-common';
import { useActiveHillAnnouncement } from './hill-announcement';

export function GameAtmosphere({ room }: { room: RoomView }) {
  const audio = useAudio(); const previous = useRef<RoomView | null>(null); const playedHill = useRef<number | null>(null);
  const hill = useActiveHillAnnouncement(room.hillAnnouncement, room.serverNow);
  useEffect(() => {
    const before = previous.current; previous.current = room;
    if (!before) return;
    const answered = !before.me.genuineAnswer && Boolean(room.me.genuineAnswer); const bluffed = !before.me.bluff && Boolean(room.me.bluff);
    if (answered) audio.play('answer-submit');
    if (bluffed) audio.play('bluff-submit');
    if (!before.me.vote && room.me.vote && !room.me.vote.hill) audio.play('vote-lock');
    if (before.phase !== room.phase && room.phase === 'debate-transition') audio.play('countdown-sequence');
    else if (before.phase !== room.phase && ['bluff', 'debate', 'vote'].includes(room.phase) && !answered && !bluffed) audio.play('phase-change');
    if (before.revealStep !== room.revealStep) {
      if (room.revealStep === 'correct') { audio.play('correct'); const outcomes = room.hillPlayerIds.map((id) => room.answerPool.some((answer) => answer.isCorrect && answer.voterIds?.includes(id))); if (outcomes.some(Boolean)) window.setTimeout(() => audio.play('hill-success'), 650); if (outcomes.some((correct) => !correct)) window.setTimeout(() => audio.play('hill-fail'), outcomes.some(Boolean) ? 3300 : 650); }
      if (room.revealStep === 'bluffs') audio.play('bluffs');
    }
    if (before.phase !== room.phase && room.phase === 'results') { const gained = room.results.some((result) => result.roundPoints > 0); const lost = room.results.some((result) => result.roundPoints < 0); if (gained) audio.play('score-gain'); if (lost) window.setTimeout(() => audio.play('score-loss'), gained ? 2100 : 0); }
  }, [room, audio]);
  useEffect(() => { if (!hill || playedHill.current === hill.activatedAt) return; playedHill.current = hill.activatedAt; audio.play('hill-activate'); }, [hill?.activatedAt, audio.play]);
  return hill ? <div className="player-hill-announcement" role="status" aria-live="assertive"><span>{hill.playerName || playerName(room, hill.playerId)} has decided</span><strong>TO DIE ON THIS HILL</strong><small>Their answer remains secret.</small></div> : null;
}
