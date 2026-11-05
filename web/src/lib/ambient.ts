// Background ambience, generated in the browser with the Web Audio API. There are no audio files,
// so there is no third-party track to license. A few sine voices hold a slow chord that drifts every 8 seconds,
// filtered to stay soft under the 3D scene.

// Each chord is four frequencies (Hz), one per voice.
const CHORDS: number[][] = [
  [73.42, 110.0, 146.83, 220.0], // D2 A2 D3 A3
  [58.27, 110.0, 146.83, 174.61], // Bb1 A2 D3 F3
  [87.31, 130.81, 174.61, 220.0], // F2 C3 F3 A3
  [65.41, 98.0, 130.81, 196.0], // C2 G2 C3 G3
];
const CHORD_EVERY_MS = 8000;

export interface Ambient {
  stop: () => void;
}

// Returns null when the browser has no Web Audio support, so the caller can turn the toggle off.
export function startAmbient(): Ambient | null {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.setTargetAtTime(0.06, now, 1.5);
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700;
  filter.connect(master);

  const voices = CHORDS[0].map((freq) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.setTargetAtTime(0.25, now, 2);
    osc.connect(gain).connect(filter);
    osc.start();
    return { osc, gain };
  });

  let step = 0;
  const drift = window.setInterval(() => {
    step = (step + 1) % CHORDS.length;
    const t = ctx.currentTime;
    voices.forEach((v, i) => v.osc.frequency.setTargetAtTime(CHORDS[step][i], t, 1.5));
  }, CHORD_EVERY_MS);

  void ctx.resume().catch(() => {});

  return {
    stop: () => {
      window.clearInterval(drift);
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(0, t, 0.4);
      voices.forEach((v) => v.osc.stop(t + 1.5));
      window.setTimeout(() => void ctx.close(), 1600);
    },
  };
}
