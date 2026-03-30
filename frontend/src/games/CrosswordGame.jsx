import React, { useState, useEffect, useRef } from 'react';

const PUZZLES = [
  {
    title: 'Crypto Basics',
    grid: [
      { word: 'BLOCK', clue: 'Fundamental unit of a blockchain (5)', row: 0, col: 0, dir: 'across' },
      { word: 'TOKEN', clue: 'Digital asset on a network (5)', row: 2, col: 1, dir: 'across' },
      { word: 'MINER', clue: 'One who validates transactions (5)', row: 4, col: 0, dir: 'across' },
      { word: 'BLTEM', clue: 'Down from B: block-token link (5)', row: 0, col: 0, dir: 'down' },
      { word: 'LOKIN', clue: 'Second column descender (5)', row: 0, col: 1, dir: 'down' },
    ],
  },
  {
    title: 'DeFi World',
    grid: [
      { word: 'YIELD', clue: 'Return on staked assets (5)', row: 0, col: 0, dir: 'across' },
      { word: 'STAKE', clue: 'Lock tokens for rewards (5)', row: 2, col: 0, dir: 'across' },
      { word: 'POOLS', clue: 'Liquidity _____ (5)', row: 4, col: 1, dir: 'across' },
      { word: 'ETHER', clue: 'Native currency of Ethereum (5)', row: 0, col: 2, dir: 'across' },
      { word: 'DEFI', clue: 'Decentralized Finance abbrev (4)', row: 1, col: 0, dir: 'across' },
    ],
  },
  {
    title: 'Web3 Terms',
    grid: [
      { word: 'WALLET', clue: 'Stores your crypto keys (6)', row: 0, col: 0, dir: 'across' },
      { word: 'BRIDGE', clue: 'Connects two blockchains (6)', row: 2, col: 0, dir: 'across' },
      { word: 'ORACLE', clue: 'Off-chain data provider (6)', row: 4, col: 0, dir: 'across' },
      { word: 'SMART', clue: '_____ contract (5)', row: 1, col: 1, dir: 'across' },
      { word: 'NODES', clue: 'Network participants (5)', row: 3, col: 1, dir: 'across' },
    ],
  },
];

function buildGrid(puzzle) {
  const cells = {};
  const clues = { across: [], down: [] };
  let clueNum = 1;

  for (const entry of puzzle.grid) {
    const { word, clue, row, col, dir } = entry;
    const num = clueNum++;
    clues[dir].push({ num, clue, word, row, col });
    for (let i = 0; i < word.length; i++) {
      const r = dir === 'across' ? row : row + i;
      const c = dir === 'across' ? col + i : col;
      const key = `${r}-${c}`;
      if (!cells[key]) {
        cells[key] = { answer: word[i], value: '', number: i === 0 ? num : cells[key]?.number || null };
      } else {
        if (i === 0) cells[key].number = num;
      }
    }
  }

  const maxR = Math.max(...Object.keys(cells).map(k => parseInt(k.split('-')[0]))) + 1;
  const maxC = Math.max(...Object.keys(cells).map(k => parseInt(k.split('-')[1]))) + 1;
  return { cells, clues, rows: maxR, cols: maxC };
}

export default function CrosswordGame({ onScoreSubmit, competitionId }) {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [gridData, setGridData] = useState(null);
  const [userCells, setUserCells] = useState({});
  const [selectedCell, setSelectedCell] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [puzzleScores, setPuzzleScores] = useState([]);
  const [checked, setChecked] = useState(false);
  const inputRefs = useRef({});

  useEffect(() => {
    loadPuzzle(puzzleIndex);
  }, [puzzleIndex]);

  function loadPuzzle(idx) {
    const puzzle = PUZZLES[idx];
    const gd = buildGrid(puzzle);
    setGridData(gd);
    const uc = {};
    for (const key of Object.keys(gd.cells)) {
      uc[key] = '';
    }
    setUserCells(uc);
    setChecked(false);
    setSelectedCell(null);
  }

  function handleCellChange(key, value) {
    if (checked) return;
    const v = value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
    setUserCells(prev => ({ ...prev, [key]: v }));
  }

  function checkPuzzle() {
    if (!gridData) return;
    let correct = 0;
    let total = 0;
    for (const [key, cell] of Object.entries(gridData.cells)) {
      total++;
      if (userCells[key] === cell.answer) correct++;
    }
    const score = Math.round((correct / total) * 300 * (puzzleIndex + 1));
    setPuzzleScores(prev => [...prev, score]);
    setTotalScore(prev => prev + score);
    setChecked(true);
  }

  function nextPuzzle() {
    if (puzzleIndex < PUZZLES.length - 1) {
      setPuzzleIndex(prev => prev + 1);
    } else {
      setCompleted(true);
    }
  }

  const allDone = completed;

  if (!gridData) return <div>Loading...</div>;

  const puzzle = PUZZLES[puzzleIndex];

  return (
    <div className="game-container crossword-game">
      <div className="game-header">
        <h3>📝 Crossword Challenge</h3>
        <div className="game-stats">
          <span className="stat">Puzzle {puzzleIndex + 1}/{PUZZLES.length}</span>
          <span className="stat">Score: {totalScore}</span>
        </div>
      </div>

      <h4 style={{ textAlign: 'center', color: 'var(--accent-glow)', marginBottom: '12px' }}>{puzzle.title}</h4>

      <div className="crossword-layout">
        <div className="crossword-grid" style={{ gridTemplateColumns: `repeat(${gridData.cols}, 40px)`, gridTemplateRows: `repeat(${gridData.rows}, 40px)` }}>
          {Array.from({ length: gridData.rows }).map((_, r) =>
            Array.from({ length: gridData.cols }).map((_, c) => {
              const key = `${r}-${c}`;
              const cell = gridData.cells[key];
              if (!cell) {
                return <div key={key} className="crossword-cell dark"></div>;
              }
              const isCorrect = checked && userCells[key] === cell.answer;
              const isWrong = checked && userCells[key] !== cell.answer;
              return (
                <div key={key} className={`crossword-cell ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''} ${selectedCell === key ? 'selected' : ''}`}
                  onClick={() => { setSelectedCell(key); inputRefs.current[key]?.focus(); }}>
                  {cell.number && <span className="cell-number">{cell.number}</span>}
                  <input
                    ref={el => inputRefs.current[key] = el}
                    className="cell-input"
                    maxLength={1}
                    value={userCells[key] || ''}
                    onChange={e => handleCellChange(key, e.target.value)}
                    disabled={checked}
                  />
                </div>
              );
            })
          )}
        </div>

        <div className="crossword-clues">
          {gridData.clues.across.length > 0 && (
            <div>
              <h5>Across</h5>
              {gridData.clues.across.map(c => (
                <p key={`a-${c.num}`} className="clue-item"><strong>{c.num}.</strong> {c.clue}</p>
              ))}
            </div>
          )}
          {gridData.clues.down.length > 0 && (
            <div>
              <h5>Down</h5>
              {gridData.clues.down.map(c => (
                <p key={`d-${c.num}`} className="clue-item"><strong>{c.num}.</strong> {c.clue}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {checked && (
        <div className="game-feedback success">
          Puzzle scored: {puzzleScores[puzzleScores.length - 1]} points
        </div>
      )}

      {!checked && (
        <button className="btn btn-primary btn-full game-submit" onClick={checkPuzzle}>
          Check Answers
        </button>
      )}

      {checked && !allDone && (
        <button className="btn btn-primary btn-full game-submit" onClick={nextPuzzle}>
          Next Puzzle →
        </button>
      )}

      {allDone && (
        <button className="btn btn-primary btn-full game-submit"
          onClick={() => onScoreSubmit && onScoreSubmit(totalScore, `Crossword: ${puzzleScores.length} puzzles, score: ${totalScore}`)}>
          Submit Score ({totalScore} pts)
        </button>
      )}
    </div>
  );
}
