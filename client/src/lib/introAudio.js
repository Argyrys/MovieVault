let audioCtx = null;
let scheduled = false;
let analyser = null;
let peakBuf = null;

function scheduleScore(ctx) {
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.value = 0.5;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  peakBuf = new Float32Array(analyser.fftSize);
  master.connect(analyser).connect(ctx.destination);

  // Deep "ta-dum" bass hit
  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(88, now);
  bass.frequency.exponentialRampToValueAtTime(42, now + 0.6);
  bassGain.gain.setValueAtTime(0.0001, now);
  bassGain.gain.exponentialRampToValueAtTime(0.9, now + 0.03);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  bass.connect(bassGain).connect(master);
  bass.start(now);
  bass.stop(now + 1.2);

  // Second softer pulse (the "dum")
  const pulse = ctx.createOscillator();
  const pulseGain = ctx.createGain();
  pulse.type = 'sine';
  pulse.frequency.setValueAtTime(66, now + 0.28);
  pulse.frequency.exponentialRampToValueAtTime(36, now + 0.9);
  pulseGain.gain.setValueAtTime(0.0001, now + 0.28);
  pulseGain.gain.exponentialRampToValueAtTime(0.55, now + 0.36);
  pulseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
  pulse.connect(pulseGain).connect(master);
  pulse.start(now + 0.28);
  pulse.stop(now + 1.4);

  // Rising shimmer while letters fly in
  [880, 1320, 1760].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const start = now + 0.5 + i * 0.12;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.08, start + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + 1.5);
  });

  // Whoosh synced with the gold sweep
  const wDur = 1.2;
  const wStart = now + 1.9;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * wDur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(500, wStart);
  bp.frequency.exponentialRampToValueAtTime(4200, wStart + 0.55);
  bp.frequency.exponentialRampToValueAtTime(700, wStart + wDur);
  const wg = ctx.createGain();
  wg.gain.setValueAtTime(0.0001, wStart);
  wg.gain.exponentialRampToValueAtTime(0.16, wStart + 0.4);
  wg.gain.exponentialRampToValueAtTime(0.0001, wStart + wDur);
  noise.connect(bp).connect(wg).connect(master);
  noise.start(wStart);
  noise.stop(wStart + wDur + 0.05);
}

// Creates the AudioContext once (module scope keeps it alive after React unmount),
// schedules the score, and resumes playback if the browser allows it.
export function ensureIntroAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (!scheduled) {
    try {
      scheduleScore(audioCtx);
      scheduled = true;
    } catch {
      return audioCtx;
    }
  }
  if (audioCtx.state !== 'running') {
    audioCtx.resume().then(() => {}).catch(() => {});
  }
  return audioCtx;
}

export function introAudioState() {
  return audioCtx ? audioCtx.state : 'none';
}

// Peak absolute sample level currently passing through the master bus (0 = silence).
export function introAudioPeak() {
  if (!analyser || !peakBuf) return 0;
  analyser.getFloatTimeDomainData(peakBuf);
  let peak = 0;
  for (let i = 0; i < peakBuf.length; i++) {
    const v = Math.abs(peakBuf[i]);
    if (v > peak) peak = v;
  }
  return peak;
}
