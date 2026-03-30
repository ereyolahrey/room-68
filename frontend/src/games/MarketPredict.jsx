import React, { useState, useEffect, useRef } from 'react';

function generatePriceData(length, startPrice) {
  const prices = [startPrice];
  for (let i = 1; i < length; i++) {
    const change = (Math.random() - 0.48) * startPrice * 0.04;
    prices.push(Math.max(0.01, prices[i - 1] + change));
  }
  return prices;
}

function MiniChart({ prices, predictions, currentIdx }) {
  const width = 500;
  const height = 200;
  const padding = 30;
  const maxP = Math.max(...prices) * 1.05;
  const minP = Math.min(...prices) * 0.95;

  function x(i) { return padding + (i / (prices.length - 1)) * (width - 2 * padding); }
  function y(p) { return padding + ((maxP - p) / (maxP - minP)) * (height - 2 * padding); }

  const visiblePrices = prices.slice(0, currentIdx + 1);
  const pathD = visiblePrices.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="market-chart">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#44aaff" />
          <stop offset="100%" stopColor="#44ff88" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
        const py = padding + frac * (height - 2 * padding);
        const price = maxP - frac * (maxP - minP);
        return (
          <g key={i}>
            <line x1={padding} y1={py} x2={width - padding} y2={py} stroke="#333" strokeWidth="0.5" />
            <text x={5} y={py + 4} fill="#888" fontSize="10">${price.toFixed(0)}</text>
          </g>
        );
      })}
      {/* Price line */}
      <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth="2" />
      {/* Current price dot */}
      {currentIdx < prices.length && (
        <circle cx={x(currentIdx)} cy={y(prices[currentIdx])} r="4" fill="#44ff88" />
      )}
      {/* Prediction markers */}
      {predictions.map((pred, i) => {
        const pi = pred.atIndex;
        if (pi >= visiblePrices.length) return null;
        return (
          <g key={`pred-${i}`}>
            <circle cx={x(pi)} cy={y(prices[pi])} r="3"
              fill={pred.correct === null ? '#ffaa44' : pred.correct ? '#44ff88' : '#ff4466'}
              stroke="#fff" strokeWidth="1" />
            <text x={x(pi)} y={y(prices[pi]) - 8} fill={pred.correct === null ? '#ffaa44' : pred.correct ? '#44ff88' : '#ff4466'}
              fontSize="10" textAnchor="middle">
              {pred.direction === 'up' ? '↑' : '↓'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const SCENARIOS = [
  { name: 'Bitcoin Simulation', symbol: 'BTC', startPrice: 45000, length: 40, predictionPoints: 8 },
  { name: 'Ethereum Simulation', symbol: 'ETH', startPrice: 2800, length: 40, predictionPoints: 8 },
  { name: 'Volatile Altcoin', symbol: 'ALT', startPrice: 12, length: 40, predictionPoints: 10 },
];

export default function MarketPredict({ onScoreSubmit, competitionId }) {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [prices, setPrices] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [predictions, setPredictions] = useState([]);
  const [awaitingPred, setAwaitingPred] = useState(false);
  const [roundScore, setRoundScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [scenarioScores, setScenarioScores] = useState([]);
  const [roundDone, setRoundDone] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    startScenario(scenarioIdx);
    return () => clearInterval(timerRef.current);
  }, [scenarioIdx]);

  function startScenario(idx) {
    const sc = SCENARIOS[idx];
    const newPrices = generatePriceData(sc.length, sc.startPrice);
    setPrices(newPrices);
    setCurrentIdx(0);
    setPredictions([]);
    setRoundScore(0);
    setRoundDone(false);
    setAwaitingPred(false);
    startTimer(newPrices, sc);
  }

  function startTimer(priceData, sc) {
    clearInterval(timerRef.current);
    let idx = 0;
    const predictionInterval = Math.floor(sc.length / sc.predictionPoints);

    timerRef.current = setInterval(() => {
      idx++;
      if (idx >= priceData.length) {
        clearInterval(timerRef.current);
        setRoundDone(true);
        return;
      }
      setCurrentIdx(idx);

      setPredictions(prev => {
        const updated = prev.map(p => {
          if (p.correct !== null) return p;
          if (idx >= p.resolveAt) {
            const actualDirection = priceData[p.resolveAt] > priceData[p.atIndex] ? 'up' : 'down';
            const isCorrect = p.direction === actualDirection;
            if (isCorrect) {
              setRoundScore(s => s + 100);
            }
            return { ...p, correct: isCorrect };
          }
          return p;
        });
        return updated;
      });

      if (idx % predictionInterval === 0 && idx < priceData.length - 3) {
        setAwaitingPred(true);
        clearInterval(timerRef.current);
      }
    }, 600);
  }

  function makePrediction(direction) {
    if (!awaitingPred) return;
    const sc = SCENARIOS[scenarioIdx];
    const resolveAt = Math.min(currentIdx + 3, prices.length - 1);
    setPredictions(prev => [...prev, {
      direction,
      atIndex: currentIdx,
      resolveAt,
      correct: null,
    }]);
    setAwaitingPred(false);

    const predictionInterval = Math.floor(sc.length / sc.predictionPoints);
    let idx = currentIdx;
    timerRef.current = setInterval(() => {
      idx++;
      if (idx >= prices.length) {
        clearInterval(timerRef.current);
        setCurrentIdx(prices.length - 1);
        setPredictions(prev => prev.map(p => {
          if (p.correct !== null) return p;
          const actualDirection = prices[p.resolveAt] > prices[p.atIndex] ? 'up' : 'down';
          const isCorrect = p.direction === actualDirection;
          if (isCorrect) setRoundScore(s => s + 100);
          return { ...p, correct: isCorrect };
        }));
        setRoundDone(true);
        return;
      }
      setCurrentIdx(idx);

      setPredictions(prev => {
        const updated = prev.map(p => {
          if (p.correct !== null) return p;
          if (idx >= p.resolveAt) {
            const actualDirection = prices[p.resolveAt] > prices[p.atIndex] ? 'up' : 'down';
            const isCorrect = p.direction === actualDirection;
            if (isCorrect) setRoundScore(s => s + 100);
            return { ...p, correct: isCorrect };
          }
          return p;
        });
        return updated;
      });

      if (idx % predictionInterval === 0 && idx < prices.length - 3) {
        setAwaitingPred(true);
        clearInterval(timerRef.current);
      }
    }, 600);
  }

  function finishScenario() {
    setScenarioScores(prev => [...prev, roundScore]);
    setTotalScore(prev => prev + roundScore);
    if (scenarioIdx < SCENARIOS.length - 1) {
      setScenarioIdx(prev => prev + 1);
    } else {
      setAllDone(true);
    }
  }

  const sc = SCENARIOS[scenarioIdx];
  const currentPrice = prices[currentIdx] || 0;
  const prevPrice = currentIdx > 0 ? prices[currentIdx - 1] : currentPrice;
  const change = currentPrice - prevPrice;
  const correctCount = predictions.filter(p => p.correct === true).length;

  return (
    <div className="game-container market-game">
      <div className="game-header">
        <h3>📈 Market Prediction</h3>
        <div className="game-stats">
          <span className="stat">Scenario {scenarioIdx + 1}/{SCENARIOS.length}</span>
          <span className="stat">Score: {totalScore + roundScore}</span>
        </div>
      </div>

      <div className="market-info">
        <h4>{sc.name} ({sc.symbol})</h4>
        <div className="price-display">
          <span className="current-price">${currentPrice.toFixed(2)}</span>
          <span className={`price-change ${change >= 0 ? 'up' : 'down'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)} ({((change / prevPrice) * 100).toFixed(2)}%)
          </span>
        </div>
        <div className="prediction-stats">
          <span>Predictions: {correctCount}/{predictions.length} correct</span>
        </div>
      </div>

      <MiniChart prices={prices} predictions={predictions} currentIdx={currentIdx} />

      {awaitingPred && (
        <div className="prediction-prompt">
          <p>Where will the price go in the next 3 ticks?</p>
          <div className="prediction-buttons">
            <button className="btn btn-success predict-btn" onClick={() => makePrediction('up')}>
              ↑ Going UP
            </button>
            <button className="btn btn-danger predict-btn" onClick={() => makePrediction('down')}>
              ↓ Going DOWN
            </button>
          </div>
        </div>
      )}

      {!awaitingPred && !roundDone && (
        <div className="game-instructions" style={{ textAlign: 'center' }}>
          Watching market... predictions will be prompted periodically
        </div>
      )}

      {roundDone && !allDone && (
        <div>
          <div className="game-feedback success">
            {sc.symbol} round: {correctCount}/{predictions.length} correct = {roundScore} pts
          </div>
          <button className="btn btn-primary btn-full game-submit" onClick={finishScenario}>
            Next Scenario →
          </button>
        </div>
      )}

      {allDone && (
        <div>
          <div className="game-feedback success">
            All scenarios complete! Total: {totalScore + roundScore} pts
          </div>
          <button className="btn btn-primary btn-full game-submit"
            onClick={() => {
              const final = totalScore + roundScore;
              onScoreSubmit && onScoreSubmit(final, `Market Prediction: ${scenarioScores.length + 1} scenarios, ${correctCount} correct, score: ${final}`);
            }}>
            Submit Score ({totalScore + roundScore} pts)
          </button>
        </div>
      )}
    </div>
  );
}
