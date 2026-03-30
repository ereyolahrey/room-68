import React, { useState, useRef, useEffect, useCallback } from 'react';

const INSTRUMENTS = ['Kick', 'Snare', 'HiHat', 'Clap', 'Bass', 'Synth'];
const STEPS = 16;
const COLORS = ['#ff4466', '#ffaa44', '#44aaff', '#44ff88', '#cc44ff', '#ff88cc'];

function createAudioContext() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(ctx, type, time) {
  const now = time || ctx.currentTime;
  switch (type) {
    case 'Kick': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.3);
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    }
    case 'Snare': {
      const bufferSize = ctx.sampleRate * 0.1;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      noise.connect(gain).connect(ctx.destination);
      noise.start(now);
      break;
    }
    case 'HiHat': {
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 7000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      noise.connect(hpf).connect(gain).connect(ctx.destination);
      noise.start(now);
      break;
    }
    case 'Clap': {
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * (i < bufferSize * 0.02 ? 1 : 0.3);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.value = 2000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      noise.connect(bpf).connect(gain).connect(ctx.destination);
      noise.start(now);
      break;
    }
    case 'Bass': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, now);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    }
    case 'Synth': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }
  }
}

const TARGET_PATTERNS = [
  {
    name: 'Basic Beat',
    pattern: {
      Kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      Snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      HiHat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    },
  },
  {
    name: 'Funk Groove',
    pattern: {
      Kick:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
      Snare: [0,0,1,0, 0,1,0,0, 0,0,1,0, 0,1,0,0],
      HiHat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      Clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    },
  },
  {
    name: 'Creative Challenge',
    pattern: null,
  },
];

export default function MusicMaker({ onScoreSubmit, competitionId }) {
  const [grid, setGrid] = useState(() => {
    const g = {};
    INSTRUMENTS.forEach(inst => { g[inst] = new Array(STEPS).fill(0); });
    return g;
  });
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [challengeScores, setChallengeScores] = useState([]);
  const [checked, setChecked] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);
  const stepRef = useRef(-1);
  const gridRef = useRef(grid);

  useEffect(() => { gridRef.current = grid; }, [grid]);

  function getAudioCtx() {
    if (!audioCtxRef.current) audioCtxRef.current = createAudioContext();
    return audioCtxRef.current;
  }

  function toggleCell(inst, step) {
    if (checked) return;
    setGrid(prev => {
      const ng = { ...prev };
      ng[inst] = [...prev[inst]];
      ng[inst][step] = prev[inst][step] ? 0 : 1;
      return ng;
    });
  }

  function togglePlay() {
    if (playing) {
      clearInterval(intervalRef.current);
      setPlaying(false);
      setCurrentStep(-1);
      stepRef.current = -1;
      return;
    }
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    setPlaying(true);
    stepRef.current = -1;
    const interval = (60 / bpm / 4) * 1000;
    intervalRef.current = setInterval(() => {
      stepRef.current = (stepRef.current + 1) % STEPS;
      const s = stepRef.current;
      setCurrentStep(s);
      const g = gridRef.current;
      INSTRUMENTS.forEach(inst => {
        if (g[inst][s]) playSound(ctx, inst);
      });
    }, interval);
  }

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  function clearGrid() {
    const g = {};
    INSTRUMENTS.forEach(inst => { g[inst] = new Array(STEPS).fill(0); });
    setGrid(g);
    setChecked(false);
  }

  function checkPattern() {
    const target = TARGET_PATTERNS[challengeIdx];
    if (!target.pattern) {
      const filledSteps = INSTRUMENTS.reduce((sum, inst) => sum + grid[inst].filter(Boolean).length, 0);
      const uniqueInsts = INSTRUMENTS.filter(inst => grid[inst].some(Boolean)).length;
      const score = Math.min(500, filledSteps * 10 + uniqueInsts * 50);
      setChallengeScores(prev => [...prev, score]);
      setTotalScore(prev => prev + score);
      setChecked(true);
      return;
    }

    let matches = 0;
    let total = 0;
    for (const [inst, pattern] of Object.entries(target.pattern)) {
      for (let i = 0; i < STEPS; i++) {
        total++;
        if ((grid[inst]?.[i] || 0) === pattern[i]) matches++;
      }
    }
    const accuracy = total > 0 ? matches / total : 0;
    const score = Math.round(accuracy * 300 * (challengeIdx + 1));
    setChallengeScores(prev => [...prev, score]);
    setTotalScore(prev => prev + score);
    setChecked(true);
  }

  function nextChallenge() {
    if (playing) togglePlay();
    if (challengeIdx < TARGET_PATTERNS.length - 1) {
      setChallengeIdx(prev => prev + 1);
      clearGrid();
    } else {
      setAllDone(true);
    }
  }

  const challenge = TARGET_PATTERNS[challengeIdx];

  return (
    <div className="game-container music-game">
      <div className="game-header">
        <h3>🎵 Beat Maker</h3>
        <div className="game-stats">
          <span className="stat">Challenge {challengeIdx + 1}/{TARGET_PATTERNS.length}</span>
          <span className="stat">Score: {totalScore}</span>
        </div>
      </div>

      <div className="music-challenge-info">
        <h4>{challenge.name}</h4>
        {challenge.pattern ? (
          <p className="game-instructions">Recreate the target beat pattern! Match the highlighted cells.</p>
        ) : (
          <p className="game-instructions">Create your own beat! Use all instruments for max points.</p>
        )}
        {challenge.pattern && (
          <div className="target-preview">
            {Object.entries(challenge.pattern).map(([inst, pattern]) => (
              <div key={inst} className="target-row">
                <span className="target-label">{inst}:</span>
                <div className="target-steps">
                  {pattern.map((v, i) => (
                    <div key={i} className={`target-step ${v ? 'on' : ''}`}></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sequencer">
        <div className="seq-labels">
          {INSTRUMENTS.map((inst, ii) => (
            <div key={inst} className="seq-label" style={{ color: COLORS[ii] }}>{inst}</div>
          ))}
        </div>
        <div className="seq-grid">
          {INSTRUMENTS.map((inst, ii) => (
            <div key={inst} className="seq-row">
              {grid[inst].map((v, si) => (
                <div key={si}
                  className={`seq-cell ${v ? 'active' : ''} ${currentStep === si ? 'playing' : ''} ${si % 4 === 0 ? 'beat-start' : ''}`}
                  style={v ? { background: COLORS[ii] + '88', borderColor: COLORS[ii] } : {}}
                  onClick={() => toggleCell(inst, si)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="music-controls">
        <button className={`btn ${playing ? 'btn-danger' : 'btn-primary'}`} onClick={togglePlay}>
          {playing ? '⏹ Stop' : '▶ Play'}
        </button>
        <div className="bpm-control">
          <label>BPM: {bpm}</label>
          <input type="range" min="60" max="200" value={bpm} onChange={e => setBpm(Number(e.target.value))}
            disabled={playing} />
        </div>
        {!checked && (
          <button className="btn btn-ghost" onClick={clearGrid}>Clear</button>
        )}
      </div>

      {checked && (
        <div className="game-feedback success">
          Challenge scored: {challengeScores[challengeScores.length - 1]} points
        </div>
      )}

      {!checked && (
        <button className="btn btn-primary btn-full game-submit" onClick={checkPattern}>
          Check Beat
        </button>
      )}

      {checked && !allDone && (
        <button className="btn btn-primary btn-full game-submit" onClick={nextChallenge}>
          Next Challenge →
        </button>
      )}

      {allDone && (
        <button className="btn btn-primary btn-full game-submit"
          onClick={() => onScoreSubmit && onScoreSubmit(totalScore, `Beat Maker: ${challengeScores.length} challenges, score: ${totalScore}`)}>
          Submit Score ({totalScore} pts)
        </button>
      )}
    </div>
  );
}
