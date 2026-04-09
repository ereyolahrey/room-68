import { useEffect, useRef, useState } from 'react';

// Soft ambient pad using Web Audio API — no external files needed
export default function AmbientMusic() {
  const ctxRef = useRef(null);
  const nodesRef = useRef([]);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.15);
  const gainRef = useRef(null);

  function startAmbient() {
    if (ctxRef.current) return;
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ac;

    const masterGain = ac.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ac.destination);
    gainRef.current = masterGain;

    // Reverb via convolution-like delay
    const delay = ac.createDelay(1);
    delay.delayTime.value = 0.4;
    const feedback = ac.createGain();
    feedback.gain.value = 0.3;
    const delayFilter = ac.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 1200;
    delay.connect(delayFilter);
    delayFilter.connect(feedback);
    feedback.connect(delay);
    delay.connect(masterGain);

    // Soft evolving pad chords
    const notes = [
      [130.81, 164.81, 196.00], // C3 E3 G3
      [146.83, 174.61, 220.00], // D3 F#3 A3
      [123.47, 155.56, 185.00], // B2 Eb3 F#3
      [110.00, 138.59, 164.81], // A2 C#3 E3
    ];

    let chordIndex = 0;

    function playChord() {
      if (!ctxRef.current) return;
      const ac = ctxRef.current;
      const chord = notes[chordIndex % notes.length];
      chordIndex++;

      chord.forEach((freq) => {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const osc2 = ac.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.value = freq * 2.005; // slight detune for shimmer

        const env = ac.createGain();
        const now = ac.currentTime;
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.08, now + 2);
        env.gain.linearRampToValueAtTime(0.05, now + 5);
        env.gain.linearRampToValueAtTime(0, now + 8);

        const filter = ac.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.5;

        osc.connect(env);
        osc2.connect(env);
        env.connect(filter);
        filter.connect(masterGain);
        filter.connect(delay);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 9);
        osc2.stop(now + 9);

        nodesRef.current.push(osc, osc2);
      });
    }

    playChord();
    const interval = setInterval(() => {
      if (ctxRef.current) playChord();
    }, 7000);

    nodesRef.current.push({ stop: () => clearInterval(interval) });
    setPlaying(true);
  }

  function stopAmbient() {
    nodesRef.current.forEach((n) => {
      try { n.stop(); } catch {}
    });
    nodesRef.current = [];
    if (ctxRef.current) {
      ctxRef.current.close();
      ctxRef.current = null;
    }
    gainRef.current = null;
    setPlaying(false);
  }

  function toggleAmbient() {
    if (playing) stopAmbient();
    else startAmbient();
  }

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    return () => stopAmbient();
  }, []);

  return (
    <div className="ambient-control">
      <button
        className={`ambient-btn ${playing ? 'playing' : ''}`}
        onClick={toggleAmbient}
        title={playing ? 'Stop ambient music' : 'Play ambient music'}
      >
        {playing ? '🔊' : '🔇'}
      </button>
      {playing && (
        <input
          type="range"
          className="ambient-volume"
          min="0"
          max="0.4"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          title="Volume"
        />
      )}
    </div>
  );
}
