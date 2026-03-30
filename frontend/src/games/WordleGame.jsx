import React, { useState, useCallback, useEffect } from 'react';

const WORD_LIST = [
  'CRANE', 'SLATE', 'TRACE', 'CRATE', 'STARE', 'RAISE', 'ARISE', 'AUDIO',
  'ADIEU', 'OCEAN', 'MOUNT', 'WORLD', 'CHAIN', 'BLEND', 'BRAVE', 'CLIMB',
  'DREAM', 'FLAME', 'GRACE', 'LIGHT', 'NOBLE', 'PRIDE', 'QUEST', 'SURGE',
  'VIGOR', 'YACHT', 'FROST', 'DRINK', 'JOLLY', 'PLUMB', 'QUIRK', 'SWAMP',
  'DOUGH', 'NERVE', 'PIXEL', 'GLYPH', 'SKUNK', 'BLITZ', 'CROWN', 'FORGE',
];

const VALID_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_GUESSES = 6;

export default function WordleGame({ onScoreSubmit, competitionId }) {
  const [targetWord, setTargetWord] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [round, setRound] = useState(1);
  const [totalRounds] = useState(3);
  const [roundScores, setRoundScores] = useState([]);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    startNewRound();
  }, []);

  function startNewRound() {
    const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    setTargetWord(word);
    setGuesses([]);
    setCurrentGuess('');
    setGameOver(false);
    setWon(false);
  }

  function getLetterStatus(guess, index) {
    const letter = guess[index];
    if (targetWord[index] === letter) return 'correct';
    if (targetWord.includes(letter)) return 'present';
    return 'absent';
  }

  function getKeyboardStatus() {
    const status = {};
    for (const guess of guesses) {
      for (let i = 0; i < guess.length; i++) {
        const letter = guess[i];
        const s = getLetterStatus(guess, i);
        if (status[letter] === 'correct') continue;
        if (s === 'correct') { status[letter] = 'correct'; continue; }
        if (status[letter] === 'present') continue;
        status[letter] = s;
      }
    }
    return status;
  }

  const handleKey = useCallback((key) => {
    if (gameOver) return;
    if (key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
      return;
    }
    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }
      const newGuesses = [...guesses, currentGuess];
      setGuesses(newGuesses);
      setCurrentGuess('');

      if (currentGuess === targetWord) {
        const guessCount = newGuesses.length;
        const score = Math.max(100, 600 - (guessCount - 1) * 100);
        const newRoundScores = [...roundScores, score];
        setRoundScores(newRoundScores);
        setTotalScore(prev => prev + score);
        setWon(true);
        setGameOver(true);
      } else if (newGuesses.length >= MAX_GUESSES) {
        setRoundScores(prev => [...prev, 0]);
        setGameOver(true);
      }
      return;
    }
    if (VALID_LETTERS.includes(key) && currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key);
    }
  }, [currentGuess, guesses, gameOver, targetWord, roundScores]);

  useEffect(() => {
    function handleKeyDown(e) {
      const key = e.key.toUpperCase();
      if (key === 'BACKSPACE' || key === 'ENTER' || VALID_LETTERS.includes(key)) {
        handleKey(key);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKey]);

  function handleNextRound() {
    if (round < totalRounds) {
      setRound(prev => prev + 1);
      startNewRound();
    }
  }

  const allRoundsDone = round >= totalRounds && gameOver;
  const keyboardStatus = getKeyboardStatus();
  const KEYBOARD_ROWS = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['ENTER','Z','X','C','V','B','N','M','BACKSPACE'],
  ];

  const emptyRows = MAX_GUESSES - guesses.length - (gameOver ? 0 : 1);

  return (
    <div className="game-container wordle-game">
      <div className="game-header">
        <h3>🔤 Wordle Challenge</h3>
        <div className="game-stats">
          <span className="stat">Round {round}/{totalRounds}</span>
          <span className="stat">Score: {totalScore}</span>
        </div>
      </div>

      <div className="wordle-board">
        {guesses.map((guess, gi) => (
          <div key={gi} className="wordle-row">
            {guess.split('').map((letter, li) => (
              <div key={li} className={`wordle-cell ${getLetterStatus(guess, li)}`}>
                {letter}
              </div>
            ))}
          </div>
        ))}

        {!gameOver && (
          <div className={`wordle-row ${shake ? 'shake' : ''}`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`wordle-cell ${currentGuess[i] ? 'filled' : ''}`}>
                {currentGuess[i] || ''}
              </div>
            ))}
          </div>
        )}

        {Array.from({ length: emptyRows }).map((_, i) => (
          <div key={`empty-${i}`} className="wordle-row">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="wordle-cell empty"></div>
            ))}
          </div>
        ))}
      </div>

      {gameOver && (
        <div className={`game-feedback ${won ? 'success' : 'error'}`}>
          {won ? `Correct! +${roundScores[roundScores.length - 1]} points` : `The word was: ${targetWord}`}
        </div>
      )}

      <div className="wordle-keyboard">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="keyboard-row">
            {row.map((key) => (
              <button
                key={key}
                className={`key-btn ${keyboardStatus[key] || ''} ${key.length > 1 ? 'wide' : ''}`}
                onClick={() => handleKey(key)}
              >
                {key === 'BACKSPACE' ? '⌫' : key}
              </button>
            ))}
          </div>
        ))}
      </div>

      {gameOver && !allRoundsDone && (
        <button className="btn btn-primary btn-full game-submit" onClick={handleNextRound}>
          Next Round →
        </button>
      )}

      {allRoundsDone && (
        <button className="btn btn-primary btn-full game-submit"
          onClick={() => onScoreSubmit && onScoreSubmit(totalScore, `Wordle: ${roundScores.filter(s => s > 0).length}/${totalRounds} solved, score: ${totalScore}`)}>
          Submit Score ({totalScore} pts)
        </button>
      )}
    </div>
  );
}
