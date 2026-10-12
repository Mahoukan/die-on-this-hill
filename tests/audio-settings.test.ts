import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_AUDIO_SETTINGS, restoreAudioSettings, scoreTransitionValues, serializeAudioSettings, shouldPlayEffect } from '../lib/audio-settings';
import { SOUND_ASSETS } from '../components/audio-provider';

test('audio settings serialize and restore with safe volume bounds', () => {
  const settings = restoreAudioSettings(serializeAudioSettings({ muted: true, effectsVolume: 0.35 }));
  assert.deepEqual(settings, { muted: true, effectsVolume: 0.35 });
  assert.deepEqual(restoreAudioSettings('{broken'), DEFAULT_AUDIO_SETTINGS);
  assert.deepEqual(restoreAudioSettings(JSON.stringify({ muted: false, effectsVolume: 4 })), { muted: false, effectsVolume: 1 });
});

test('mute and zero effect volume suppress playback requests', () => {
  assert.equal(shouldPlayEffect({ muted: true, effectsVolume: 1 }), false);
  assert.equal(shouldPlayEffect({ muted: false, effectsVolume: 0 }), false);
  assert.equal(shouldPlayEffect({ muted: false, effectsVolume: 0.4 }), true);
});

test('score transitions derive display values without mutating authoritative totals', () => {
  const result = { totalScore: 650, roundPoints: 200 };
  assert.deepEqual(scoreTransitionValues(result.totalScore, result.roundPoints), { previous: 450, delta: 200, final: 650 });
  assert.deepEqual(result, { totalScore: 650, roundPoints: 200 });
});

test('every mapped real sound resolves to a bundled public asset', () => {
  assert.equal(Object.keys(SOUND_ASSETS).length, 12);
  for (const source of Object.values(SOUND_ASSETS)) assert.equal(existsSync(join(process.cwd(), 'public', source!.replace(/^\/audio\//, 'audio/'))), true, source);
  assert.notEqual(SOUND_ASSETS['countdown-tick'], SOUND_ASSETS['countdown-sequence']);
});
