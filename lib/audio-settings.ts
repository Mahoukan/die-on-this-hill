export interface AudioSettings { muted: boolean; effectsVolume: number; }
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { muted: false, effectsVolume: 0.45 };
export const AUDIO_SETTINGS_KEY = 'doth-audio-settings-v1';

const volume = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
export function restoreAudioSettings(value: string | null): AudioSettings {
  if (!value) return { ...DEFAULT_AUDIO_SETTINGS };
  try { const parsed = JSON.parse(value) as Partial<AudioSettings>; return { muted: typeof parsed.muted === 'boolean' ? parsed.muted : false, effectsVolume: volume(parsed.effectsVolume, DEFAULT_AUDIO_SETTINGS.effectsVolume) }; }
  catch { return { ...DEFAULT_AUDIO_SETTINGS }; }
}
export function serializeAudioSettings(settings: AudioSettings): string { return JSON.stringify({ muted: settings.muted, effectsVolume: volume(settings.effectsVolume, 0) }); }
export function shouldPlayEffect(settings: AudioSettings): boolean { return !settings.muted && settings.effectsVolume > 0; }
export function scoreTransitionValues(totalScore: number, roundPoints: number): { previous: number; delta: number; final: number } { return { previous: totalScore - roundPoints, delta: roundPoints, final: totalScore }; }
