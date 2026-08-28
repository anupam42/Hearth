/**
 * Generates real ambient noise loops client-side via the Web Audio API — filtered white
 * noise shaped per sound, not a fabricated audio file or invented track metadata.
 */
export type AmbientSoundId = "rain" | "cafe" | "forest";

interface Profile {
  filterType: BiquadFilterType;
  freq: number;
  lfoRate?: number;
  lfoDepth?: number;
}

const PROFILES: Record<AmbientSoundId, Profile> = {
  rain: { filterType: "lowpass", freq: 1100 },
  cafe: { filterType: "bandpass", freq: 650, lfoRate: 0.5, lfoDepth: 250 },
  forest: { filterType: "highpass", freq: 450, lfoRate: 0.12, lfoDepth: 120 },
};

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let filterNode: BiquadFilterNode | null = null;
let gainNode: GainNode | null = null;
let lfo: OscillatorNode | null = null;
let lfoGain: GainNode | null = null;

function ensureContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function makeNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function stopAmbient(): void {
  source?.stop();
  source?.disconnect();
  filterNode?.disconnect();
  gainNode?.disconnect();
  lfo?.stop();
  lfo?.disconnect();
  lfoGain?.disconnect();
  source = null;
  filterNode = null;
  gainNode = null;
  lfo = null;
  lfoGain = null;
}

export function startAmbient(sound: AmbientSoundId, volume: number): void {
  stopAmbient();
  const context = ensureContext();
  if (context.state === "suspended") void context.resume();

  const bufferSource = context.createBufferSource();
  bufferSource.buffer = makeNoiseBuffer(context);
  bufferSource.loop = true;

  const biquad = context.createBiquadFilter();
  const profile = PROFILES[sound];
  biquad.type = profile.filterType;
  biquad.frequency.value = profile.freq;

  const gain = context.createGain();
  gain.gain.value = volume;

  bufferSource.connect(biquad);
  biquad.connect(gain);
  gain.connect(context.destination);
  bufferSource.start();

  source = bufferSource;
  filterNode = biquad;
  gainNode = gain;

  if (profile.lfoRate) {
    const osc = context.createOscillator();
    osc.frequency.value = profile.lfoRate;
    const oscGain = context.createGain();
    oscGain.gain.value = profile.lfoDepth ?? 0;
    osc.connect(oscGain);
    oscGain.connect(biquad.frequency);
    osc.start();
    lfo = osc;
    lfoGain = oscGain;
  }
}

export function setAmbientVolume(volume: number): void {
  if (gainNode) gainNode.gain.value = volume;
}
