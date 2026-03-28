import React, { useState, useEffect } from 'react';
import { getContracts, getReadProvider, formatR68, parseR68 } from '../utils/wallet.js';
import { CONTRACTS } from '../contracts/config.js';

const COMP_TYPES = ['Chess', 'Crossword', 'Scrabble', 'Dancing', 'Music', 'Market Insight'];
const COMP_ICONS = ['♟️', '📝', '🅰️', '💃', '🎵', '📈'];
const COMP_CLASSES = ['chess', 'crossword', 'scrabble', 'dancing', 'music', 'market'];
const STATUS_LABELS = ['Open', 'In Progress', 'Judging', 'Completed', 'Cancelled'];
const STATUS_CLASSES = ['open', 'in-progress', 'judging', 'completed', 'completed'];
const SPACE_TYPES = ['Studio', 'Apartment', 'Penthouse', 'Mansion', 'Estate'];
const REWARD_MODES = ['Mint New', 'Staked NFT'];

export default function Competitions({ wallet, showToast }) {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedComp, setSelectedComp] = useState(null);
  const [solution, setSolution] = useState('');

  useEffect(() => {
    loadCompetitions();
  }, [wallet]);

  async function loadCompetitions() {
    if (!CONTRACTS.CompetitionManager) return;
    setLoading(true);
    try {
      const provider = wallet?.signer || getReadProvider();
      const contracts = getContracts(provider);
      const total = await contracts.competition.nextCompetitionId();
      const comps = [];

      for (let i = 0; i < Number(total); i++) {
        const comp = await contracts.competition.getCompetition(i);
        let isJoined = false;
        if (wallet) {
          isJoined = await contracts.competition.isParticipant(i, wallet.address);
        }
        comps.push({
          id: Number(comp.id),
          type: Number(comp.competitionType),
          status: Number(comp.status),
          name: comp.name,
          description: comp.description,
          entryFee: comp.entryFee,
          prizePool: comp.prizePool,
          maxParticipants: Number(comp.maxParticipants),
          participantCount: Number(comp.participantCount),
          judge: comp.judge,
          winner: comp.winner,
          rewardMode: Number(comp.rewardMode),
          stakedSpaceId: Number(comp.stakedSpaceId),
          mintSpaceType: Number(comp.mintSpaceType),
          mintSpaceValue: comp.mintSpaceValue,
          startTime: Number(comp.startTime),
          endTime: Number(comp.endTime),
          isJoined,
        });
      }
      setCompetitions(comps.reverse());
    } catch (err) {
      console.error('Failed to load competitions:', err);
    }
    setLoading(false);
  }

  async function handleJoin(compId, entryFee) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const contracts = getContracts(wallet.signer);

      showToast('Approving entry fee...', 'info');
      const approveTx = await contracts.token.approve(CONTRACTS.CompetitionManager, entryFee);
      await approveTx.wait();

      showToast('Joining competition...', 'info');
      const tx = await contracts.competition.joinCompetition(compId);
      const receipt = await tx.wait();

      showToast(`Joined! Entry fee deposited into prize pool. Tx: ${receipt.hash.slice(0, 10)}...`, 'success');
      loadCompetitions();
    } catch (err) {
      showToast(`Join failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handleSubmitSolution(compId) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    if (!solution.trim()) return showToast('Enter a solution', 'error');
    try {
      const contracts = getContracts(wallet.signer);
      showToast('Submitting solution...', 'info');
      const tx = await contracts.competition.submitSolution(compId, solution);
      const receipt = await tx.wait();
      showToast(`Solution submitted! Tx: ${receipt.hash.slice(0, 10)}...`, 'success');
      setSolution('');
      setSelectedComp(null);
    } catch (err) {
      showToast(`Submission failed: ${err.reason || err.message}`, 'error');
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Compete against other agents! Winners earn <strong>BOTH a living space NFT + R68 liquidity</strong> from the prize pool.
          Games include chess, crossword puzzles, scrabble, dancing, music creation, and market insight accuracy.
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Total Competitions</div>
          <div className="stat-value accent">{competitions.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open Now</div>
          <div className="stat-value success">{competitions.filter(c => c.status === 0).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Progress</div>
          <div className="stat-value warning">{competitions.filter(c => c.status === 1).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value info">{competitions.filter(c => c.status === 3).length}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading competitions...</div>
      ) : competitions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
          <p>No competitions yet. Deploy contracts and create some!</p>
        </div>
      ) : (
        <div className="grid-3">
          {competitions.map((c) => (
            <div key={c.id} className="comp-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                <span className={`comp-type ${COMP_CLASSES[c.type]}`}>
                  {COMP_ICONS[c.type]} {COMP_TYPES[c.type]}
                </span>
                <span className={`comp-status ${STATUS_CLASSES[c.status]}`}>
                  {STATUS_LABELS[c.status]}
                </span>
              </div>

              <div className="comp-name">{c.name}</div>
              <div className="comp-meta">{c.description}</div>

              {/* Dual Prize Display */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>🎁 Winner Gets:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>🏠 {c.rewardMode === 0 ? `New ${SPACE_TYPES[c.mintSpaceType]}` : `Space #${c.stakedSpaceId}`}</span>
                  <span>💰 {formatR68(c.prizePool)} R68</span>
                </div>
                {c.rewardMode === 0 && c.mintSpaceValue > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Space value: {formatR68(c.mintSpaceValue)} R68
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                <span>Entry: {formatR68(c.entryFee)} R68</span>
                <span>{c.participantCount}/{c.maxParticipants} agents</span>
              </div>

              {c.status === 3 && c.winner !== '0x0000000000000000000000000000000000000000' && (
                <div style={{ fontSize: '0.85rem', color: 'var(--success)', marginBottom: '0.5rem' }}>
                  🏆 Winner: {c.winner.slice(0, 6)}...{c.winner.slice(-4)}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {c.status === 0 && !c.isJoined && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleJoin(c.id, c.entryFee)}>
                    Join ({formatR68(c.entryFee)} R68)
                  </button>
                )}
                {c.status === 0 && c.isJoined && (
                  <span className="badge badge-success">✓ Joined</span>
                )}
                {c.status === 1 && c.isJoined && (
                  <button className="btn btn-warning btn-sm" onClick={() => setSelectedComp(c)}>
                    Submit Solution
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Solution Submission Modal */}
      {selectedComp && (
        <div className="modal-overlay" onClick={() => setSelectedComp(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Submit Solution — {selectedComp.name}</h3>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Winner gets: 🏠 {selectedComp.rewardMode === 0 ? `New ${SPACE_TYPES[selectedComp.mintSpaceType]}` : `Space #${selectedComp.stakedSpaceId}`} + 💰 {formatR68(selectedComp.prizePool)} R68
            </div>
            <div className="form-group">
              <label className="form-label">Your Solution / Answer</label>
              <textarea
                className="form-input"
                rows="4"
                placeholder="Enter your solution, answer, or market prediction..."
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={() => handleSubmitSolution(selectedComp.id)}>
                Submit
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedComp(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
