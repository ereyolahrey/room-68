import React, { useState, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

// Chess puzzles — player must find the best move(s) to win
const PUZZLES = [
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', solution: ['Qxf7'], name: 'Scholar\'s Mate', difficulty: 'Easy' },
  { fen: 'r1b1k2r/ppppqppp/2n2n2/2b1p1B1/2B1P3/3P1N2/PPP2PPP/RN1QK2R w KQkq - 0 6', solution: ['Bxf7'], name: 'Pin Attack', difficulty: 'Medium' },
  { fen: '6k1/pp4p1/2p5/2bp4/8/P5Pb/1P3rrP/2BRRK2 b - - 0 1', solution: ['Rg1'], name: 'Back Rank Mate', difficulty: 'Hard' },
  { fen: 'r2qr1k1/ppp2ppp/2np4/2b1p1B1/2B1P1b1/3P1N2/PPP2PPP/RN1QR1K1 w - - 0 9', solution: ['Bxf7'], name: 'Discovered Attack', difficulty: 'Medium' },
  { fen: '2r1r1k1/pp1n1ppp/2p1p3/q7/3P4/P1NBP3/1PQ2PPP/2R2RK1 w - - 0 1', solution: ['Nd5'], name: 'Knight Fork Setup', difficulty: 'Hard' },
];

export default function ChessGame({ onScoreSubmit, competitionId }) {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [game, setGame] = useState(() => new Chess(PUZZLES[0].fen));
  const [moveHistory, setMoveHistory] = useState([]);
  const [solved, setSolved] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [wrongMoves, setWrongMoves] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [finished, setFinished] = useState(false);

  const puzzle = PUZZLES[puzzleIndex];

  const puzzleScore = useMemo(() => {
    const base = (puzzleIndex + 1) * 200;
    const penalty = wrongMoves * 50;
    return Math.max(0, base - penalty);
  }, [puzzleIndex, wrongMoves]);

  function onDrop(sourceSquare, targetSquare) {
    if (finished) return false;

    const gameCopy = new Chess(game.fen());
    let move;
    try {
      move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    } catch { return false; }
    if (!move) return false;

    const expectedMove = puzzle.solution[0];
    if (move.san === expectedMove || move.lan === expectedMove) {
      setGame(gameCopy);
      setMoveHistory(prev => [...prev, move.san]);
      const points = puzzleScore;
      const newTotal = totalScore + points;
      setTotalScore(newTotal);
      setSolved(prev => [...prev, puzzleIndex]);
      setFeedback(`Correct! +${points} points`);
      setWrongMoves(0);

      if (puzzleIndex < PUZZLES.length - 1) {
        setTimeout(() => {
          const nextIdx = puzzleIndex + 1;
          setPuzzleIndex(nextIdx);
          setGame(new Chess(PUZZLES[nextIdx].fen));
          setFeedback('');
        }, 1500);
      } else {
        setFinished(true);
        setFeedback(`All puzzles solved! Final score: ${newTotal}`);
      }
    } else {
      setWrongMoves(prev => prev + 1);
      setFeedback(`Wrong move! Try again. (-50 penalty)`);
      return false;
    }
    return true;
  }

  const handleSubmitScore = useCallback(() => {
    if (onScoreSubmit) {
      onScoreSubmit(totalScore, `Chess puzzles: ${solved.length}/${PUZZLES.length} solved, score: ${totalScore}`);
    }
  }, [totalScore, solved, onScoreSubmit]);

  return (
    <div className="game-container chess-game">
      <div className="game-header">
        <h3>♟️ Chess Puzzle Challenge</h3>
        <div className="game-stats">
          <span className="stat">Puzzle {puzzleIndex + 1}/{PUZZLES.length}</span>
          <span className="stat">Score: {totalScore}</span>
          <span className="stat">Solved: {solved.length}</span>
        </div>
      </div>

      <div className="game-info-bar">
        <span className="puzzle-name">{puzzle.name}</span>
        <span className={`difficulty ${puzzle.difficulty.toLowerCase()}`}>{puzzle.difficulty}</span>
      </div>

      <div className="chess-board-wrapper">
        <Chessboard
          position={game.fen()}
          onPieceDrop={onDrop}
          boardWidth={400}
          customBoardStyle={{ borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
          customDarkSquareStyle={{ backgroundColor: '#1b3158' }}
          customLightSquareStyle={{ backgroundColor: '#1a1a2e' }}
        />
      </div>

      {feedback && (
        <div className={`game-feedback ${feedback.includes('Correct') || feedback.includes('solved') ? 'success' : 'error'}`}>
          {feedback}
        </div>
      )}

      <div className="game-instructions">
        <p>Find the best move! {game.turn() === 'w' ? 'White' : 'Black'} to play.</p>
        {wrongMoves > 0 && <p className="hint">Wrong attempts: {wrongMoves}</p>}
      </div>

      {(finished || solved.length > 0) && (
        <button className="btn btn-primary btn-full game-submit" onClick={handleSubmitScore}>
          Submit Score ({totalScore} pts)
        </button>
      )}
    </div>
  );
}
