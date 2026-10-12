'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AUDIO_SETTINGS_KEY, DEFAULT_AUDIO_SETTINGS, restoreAudioSettings, serializeAudioSettings, shouldPlayEffect, type AudioSettings } from '../lib/audio-settings';

export type SoundCue = 'answer-submit' | 'bluff-submit' | 'countdown-tick' | 'countdown-sequence' | 'phase-change' | 'hill-activate' | 'hill-success' | 'hill-fail' | 'score-gain' | 'score-loss' | 'winner' | 'award-reveal' | 'vote-lock' | 'correct' | 'bluffs';
interface AudioContextValue { settings: AudioSettings; update: (patch: Partial<AudioSettings>) => void; play: (cue: SoundCue) => boolean; }
const AudioContextState = createContext<AudioContextValue | null>(null);

export const SOUND_ASSETS: Partial<Record<SoundCue, string>> = {
  'answer-submit': '/audio/gameplay/answer-submit.mp3', 'bluff-submit': '/audio/gameplay/bluff-submit.wav', 'countdown-tick': '/audio/gameplay/countdown-tick.wav', 'countdown-sequence': '/audio/gameplay/countdown-tick.mp3', 'phase-change': '/audio/gameplay/phase-change.mp3',
  'hill-activate': '/audio/hill/hill-activate.wav', 'hill-success': '/audio/hill/hill-success.wav', 'hill-fail': '/audio/hill/hill-fail.wav',
  'score-gain': '/audio/results/score-gain.wav', 'score-loss': '/audio/results/score-loss.wav', winner: '/audio/results/winner.wav', 'award-reveal': '/audio/results/award-reveal.wav',
};
const SYNTH_PATTERNS: Partial<Record<SoundCue, Array<[frequency: number, offset: number, duration: number]>>> = {
  'vote-lock': [[330, 0, 0.05], [220, 0.055, 0.08]], correct: [[392, 0, 0.12], [523, 0.12, 0.12], [784, 0.24, 0.3]], bluffs: [[294, 0, 0.08], [247, 0.1, 0.12]],
};
const MAX_PLAY_MS: Partial<Record<SoundCue, number>> = { 'countdown-sequence': 3100, 'phase-change': 1800, 'hill-activate': 2300, 'bluff-submit': 2200 };
const COOLDOWN_MS: Partial<Record<SoundCue, number>> = { 'countdown-tick': 450, 'countdown-sequence': 2500, 'phase-change': 700, 'award-reveal': 1500 };

export function AudioProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_AUDIO_SETTINGS);
  const settingsRef = useRef(settings); const contextRef = useRef<AudioContext | null>(null); const unlocked = useRef(false); const assets = useRef(new Map<SoundCue, HTMLAudioElement>()); const stopTimers = useRef(new Map<SoundCue, number>()); const lastPlayed = useRef(new Map<SoundCue, number>());
  const stopAll = useCallback(() => { for (const timer of stopTimers.current.values()) window.clearTimeout(timer); stopTimers.current.clear(); for (const audio of assets.current.values()) { audio.pause(); audio.currentTime = 0; } }, []);
  useEffect(() => {
    let stored: string | null = null; try { stored = localStorage.getItem(AUDIO_SETTINGS_KEY); } catch { /* Restricted storage keeps safe defaults. */ } const restored = restoreAudioSettings(stored); settingsRef.current = restored; setSettings(restored);
    for (const [cue, source] of Object.entries(SOUND_ASSETS) as Array<[SoundCue, string]>) { const audio = new Audio(source); audio.preload = 'auto'; assets.current.set(cue, audio); }
    const unlock = () => { unlocked.current = true; window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); }; window.addEventListener('pointerdown', unlock, { once: true }); window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); stopAll(); assets.current.clear(); void contextRef.current?.close(); };
  }, [stopAll]);
  const update = useCallback((patch: Partial<AudioSettings>) => { setSettings((current) => { const next = { ...current, ...patch }; settingsRef.current = next; if (next.muted) stopAll(); try { localStorage.setItem(AUDIO_SETTINGS_KEY, serializeAudioSettings(next)); } catch { /* Settings still apply for this page. */ } return next; }); }, [stopAll]);
  const playSynth = useCallback((cue: SoundCue, volume: number) => {
    const pattern = SYNTH_PATTERNS[cue]; if (!pattern) return false; const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AudioCtor) return false;
    let context: AudioContext; try { context = contextRef.current ?? new AudioCtor(); contextRef.current = context; } catch { return false; } if (context.state === 'suspended') void context.resume(); const start = context.currentTime + 0.01;
    for (const [frequency, offset, duration] of pattern) { const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.0001, start + offset); gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.08), start + offset + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration); oscillator.connect(gain).connect(context.destination); oscillator.start(start + offset); oscillator.stop(start + offset + duration + 0.02); }
    return true;
  }, []);
  const play = useCallback((cue: SoundCue) => {
    const current = settingsRef.current; if (!unlocked.current || !shouldPlayEffect(current) || typeof window === 'undefined') return false;
    const now = Date.now(); const cooldown = COOLDOWN_MS[cue] ?? 180; if (now - (lastPlayed.current.get(cue) ?? 0) < cooldown) return false; lastPlayed.current.set(cue, now);
    const audio = assets.current.get(cue); if (!audio) return playSynth(cue, current.effectsVolume);
    const oldTimer = stopTimers.current.get(cue); if (oldTimer) window.clearTimeout(oldTimer); audio.pause(); audio.currentTime = 0; audio.volume = current.effectsVolume; void audio.play().catch(() => {});
    const maximum = MAX_PLAY_MS[cue]; if (maximum) stopTimers.current.set(cue, window.setTimeout(() => { audio.pause(); audio.currentTime = 0; stopTimers.current.delete(cue); }, maximum));
    return true;
  }, [playSynth]);
  return <AudioContextState.Provider value={{ settings, update, play }}>{children}</AudioContextState.Provider>;
}

export function useAudio() { const value = useContext(AudioContextState); if (!value) throw new Error('AudioProvider is missing'); return value; }

export function AudioSettingsControl({ compact = false }: { compact?: boolean }) {
  const audio = useAudio(); const [open, setOpen] = useState(false);
  return <div className={`audio-settings${compact ? ' is-compact' : ''}`}><button className="audio-settings-trigger" type="button" aria-expanded={open} aria-label="Sound settings" onClick={() => setOpen(!open)}>{audio.settings.muted ? 'SOUND OFF' : 'SOUND'}</button>{open && <div className="audio-settings-panel"><strong>Sound</strong><label><span>Effects volume</span><input type="range" min="0" max="1" step="0.05" value={audio.settings.effectsVolume} onChange={(event) => audio.update({ effectsVolume: Number(event.target.value) })} /></label><button className="btn btn-ghost btn-small" type="button" onClick={() => audio.update({ muted: !audio.settings.muted })}>{audio.settings.muted ? 'Unmute' : 'Mute all sound'}</button><small>Settings apply only to this device.</small></div>}</div>;
}
