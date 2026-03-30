import React, { useState, useEffect, useRef, useCallback } from 'react';

const ARROWS = ['↑', '←', '↓', '→'];
const ARROW_KEYS = { ArrowUp: '↑', ArrowLeft: '←', ArrowDown: '↓', ArrowRight: '→' };
const ARROW_COLORS = { '↑': '#ff4466', '←': '#44aaff', '↓': '#44ff88', '→': '#ffaa44' };

function generateSequence(length, bpm) {
  const seq = [];
  const interval = 60000 / bpm;
  for (let i = 0; i < length; i++) {
    seq.push({
      arrow: ARROWS[Math.floor(Math.random() * ARROWS.length)],
      time: 2000 + i * interval,
      id: i,
      hit: null,
    });
  }
  return seq;
}

const ROUNDS = [
  { name: 'Warm Up', bpm: 80, count: 12 },
  { name: 'Groove', bpm: 110, count: 20 },
  { name: 'Fire Round', bpm: 150, count: 30 },
];

export default function DanceGame({ onScoreSubmit, competitionId }) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [sequence, setSequence] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [roundScores, setRoundScores] = useState([]);
  const [roundDone, setRoundDone] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [lastHit, setLastHit] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  const seqRef = useRef([]);

  const HIT_WINDOW = 400;
  const TRAVEL_TIME = 2000;

  function startRound() {
    const cfg = ROUNDS[roundIdx];
    const seq = generateSequence(cfg.count, cfg.bpm);
    setSequence(seq);
    seqRef.current = seq;
    setRoundScore(0);
    setCombo(0);
    setMaxCombo(0);
    setRoundDone(false);
    setLastHit(null);

    setCountdown(3);
    let c = 3;
    const iv = setInterval(() => {
      c--;
      if (c === 0) {
        clearInterval(iv);
        setCountdown(null);
        setPlaying(true);
        startRef.current = performance.now();
        animate();
      } else {
        setCountdown(c);
      }
    }, 700);
  }

  function animate() {
    const now = performance.now();
    const e = now - startRef.current;
    setElapsed(e);
    const lastNote = seqRef.current[seqRef.current.length - 1];
    if (e > lastNote.time + TRAVEL_TIME + 500) {
      setPlaying(false);
      finishRound();
      return;
    }
    rafRef.current = requestAnimationFrame(animate);
  }

  function finishRound() {
    const hits = seqRef.current.filter(n => n.hit === 'perfect' || n.hit === 'good').length;
    const perfects = seqRef.current.filter(n => n.hit === 'perfect').length;
    const score = roundScore;
    setRoundScores(prev => [...prev, score]);
    setTotalScore(prev => prev + score);
    setRoundDone(true);
  }

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (!playing) return;
    const arrow = ARROW_KEYS[e.key];
    if (!arrow) return;
    e.preventDefault();

    const now = performance.now() - startRef.current;
    const targetY = 80;

    let bestNote = null;
    let bestDist = Infinity;
    for (const note of seqRef.current) {
      if (note.hit !== null) continue;
      if (note.arrow !== arrow) continue;
      const dist = Math.abs(note.time - now);
      if (dist < bestDist && dist < HIT_WINDOW) {
        bestDist = dist;
        bestNote = note;
      }
    }

    if (bestNote) {
      const isPerfect = bestDist < 100;
      bestNote.hit = isPerfect ? 'perfect' : 'good';
      const points = isPerfect ? 100 : 50;
      const comboBonus = Math.min(combo, 10) * 5;
      setRoundScore(prev => prev + points + comboBonus);
      setCombo(prev => {
        const nc = prev + 1;
        setMaxCombo(m => Math.max(m, nc));
        return nc;
      });
      setLastHit(isPerfect ? 'PERFECT!' : 'GOOD');
      setTimeout(() => setLastHit(null), 400);
    } else {
      setCombo(0);
      setLastHit('MISS');
      setTimeout(() => setLastHit(null), 400);
    }
    setSequence([...seqRef.current]);
  }, [playing, combo, roundScore]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function nextRound() {
    if (roundIdx < ROUNDS.length - 1) {
      setRoundIdx(prev => prev + 1);
    } else {
      setAllDone(true);
    }
  }

  const cfg = ROUNDS[roundIdx];

  return (
    <div className="game-container dance-game">
      <div className="game-header">
        <h3>💃 Dance Battle</h3>
        <div className="game-stats">
          <span className="stat">Round {roundIdx + 1}/{ROUNDS.length}</span>
          <span className="stat">Score: {totalScore + roundScore}</span>
          <span className="stat">Combo: {combo}x</span>
        </div>
      </div>

      {!playing && !roundDone && !allDone && (
        <div className="dance-start">
          <h4>{cfg.name}</h4>
          <p>{cfg.count} moves at {cfg.bpm} BPM</p>
          <p className="game-instructions">Press arrow keys (↑ ← ↓ →) in time with the falling arrows!</p>
          {countdown !== null ? (
            <div className="countdown">{countdown}</div>
          ) : (
            <button className="btn btn-primary btn-full" onClick={startRound}>Start Round!</button>
          )}
        </div>
      )}

      {(playing || roundDone) && (
        <div className="dance-arena">
          <div className="dance-lanes">
            {ARROWS.map((arrow) => (
              <div key={arrow} className="lane">
                <div className="target-zone" style={{ borderColor: ARROW_COLORS[arrow] }}>
                  {arrow}
                </div>
                {sequence
                  .filter(n => n.arrow === arrow && n.hit === null)
                  .map(note => {
                    const progress = (elapsed - (note.time - TRAVEL_TIME)) / TRAVEL_TIME;
                    if (progress < 0 || progress > 1.2) return null;
                    const top = progress * 300;
                    return (
                      <div key={note.id} className="dance-note"
                        style={{ top: `${top}px`, color: ARROW_COLORS[arrow], opacity: progress > 1 ? 0.3 : 1 }}>
                        {arrow}
                      </div>
                    );
                  })}
                {sequence
                  .filter(n => n.arrow === arrow && n.hit !== null)
                  .slice(-1)
                  .map(note => (
                    <div key={`hit-${note.id}`} className={`hit-flash ${note.hit}`}>
                      {note.hit === 'perfect' ? '✨' : '✓'}
                    </div>
                  ))}
              </div>
            ))}
          </div>

          {lastHit && (
            <div className={`hit-label ${lastHit === 'MISS' ? 'miss' : lastHit === 'PERFECT!' ? 'perfect' : 'good'}`}>
              {lastHit}
            </div>
          )}
        </div>
      )}

      {roundDone && !allDone && (
        <div className="dance-results">
          <div className="game-feedback success">
            Round complete! +{roundScores[roundScores.length - 1]} points | Max combo: {maxCombo}x
          </div>
          <button className="btn btn-primary btn-full game-submit" onClick={nextRound}>
            Next Round →
          </button>
        </div>
      )}

      {allDone && (
        <div className="dance-results">
          <div className="game-feedback success">
            Dance complete! Total: {totalScore} points
          </div>
          <button className="btn btn-primary btn-full game-submit"
            onClick={() => onScoreSubmit && onScoreSubmit(totalScore, `Dance Battle: ${ROUNDS.length} rounds, score: ${totalScore}, max combo: ${maxCombo}x`)}>
            Submit Score ({totalScore} pts)
          </button>
        </div>
      )}
    </div>
  );
}
