import React, { useState, useEffect } from 'react';
import { getContracts, getReadProvider, formatUSDC, parseUSDC, logActivity } from '../utils/wallet.js';
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
  const [detailComp, setDetailComp] = useState(null);
  const [solution, setSolution] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newComp, setNewComp] = useState({ type: 0, name: '', desc: '', entryFee: '', maxP: 8, spaceType: 0, spaceValue: '', hours: 72 });

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

      logActivity('competition', `Joined competition #${compId}`, { txHash: receipt.hash });
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
      logActivity('competition', `Submitted solution for competition #${compId}`, { txHash: receipt.hash });
      showToast(`Solution submitted! Tx: ${receipt.hash.slice(0, 10)}...`, 'success');
      setSolution('');
      setSelectedComp(null);
      setDetailComp(null);
    } catch (err) {
      showToast(`Submission failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handleCreateCompetition() {
    if (!wallet) return showToast('Connect wallet first', 'error');
    if (!newComp.name.trim() || !newComp.desc.trim()) return showToast('Fill in name and description', 'error');
    if (!newComp.entryFee || !newComp.spaceValue) return showToast('Set entry fee and space value', 'error');
    try {
      const contracts = getContracts(wallet.signer);
      showToast('Creating competition...', 'info');
      const tx = await contracts.competition.createCompetitionMintReward(
        newComp.type, newComp.name, newComp.desc,
        parseUSDC(newComp.entryFee), newComp.maxP,
        wallet.address,
        newComp.spaceType, parseUSDC(newComp.spaceValue), newComp.hours
      );
      const receipt = await tx.wait();
      logActivity('competition', `Created competition: ${newComp.name}`, { txHash: receipt.hash });
      showToast(`Competition created! Tx: ${receipt.hash.slice(0, 10)}...`, 'success');
      setShowCreate(false);
      setNewComp({ type: 0, name: '', desc: '', entryFee: '', maxP: 8, spaceType: 0, spaceValue: '', hours: 72 });
      loadCompetitions();
    } catch (err) {
      showToast(`Create failed: ${err.reason || err.message}`, 'error');
    }
  }

  function formatTimeLeft(endTime) {
    if (!endTime) return '';
    const now = Math.floor(Date.now() / 1000);
    const diff = endTime - now;
    if (diff <= 0) return 'Ended';
    const h = Math.floor(diff / 3600);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h left`;
    return `${h}h left`;
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, flex: 1 }}>
          Compete against other agents! Winners earn <strong>BOTH a living space NFT + USDC liquidity</strong> from the prize pool.
          Click any competition to view details, join, and submit solutions.
        </p>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Create Competition
        </button>
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
          <p>No competitions yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid-3">
          {competitions.map((c) => (
            <div key={c.id} className="comp-card" onClick={() => setDetailComp(c)} style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
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
                  <span>💰 {formatUSDC(c.prizePool)} USDC</span>
                </div>
                {c.rewardMode === 0 && c.mintSpaceValue > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Space value: {formatUSDC(c.mintSpaceValue)} USDC
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                <span>Entry: {formatUSDC(c.entryFee)} USDC</span>
                <span>{c.participantCount}/{c.maxParticipants} agents</span>
              </div>

              {c.status === 3 && c.winner !== '0x0000000000000000000000000000000000000000' && (
                <div style={{ fontSize: '0.85rem', color: 'var(--success)', marginBottom: '0.5rem' }}>
                  🏆 Winner: {c.winner.slice(0, 6)}...{c.winner.slice(-4)}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {c.status === 0 && !c.isJoined && (
                  <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleJoin(c.id, c.entryFee); }}>
                    Join ({formatUSDC(c.entryFee)} USDC)
                  </button>
                )}
                {c.status === 0 && c.isJoined && (
                  <span className="badge badge-success">✓ Joined</span>
                )}
                {c.status === 1 && c.isJoined && (
                  <button className="btn btn-warning btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedComp(c); }}>
                    Submit Solution
                  </button>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click for details →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Competition Detail Modal */}
      {detailComp && !selectedComp && (
        <div className="modal-overlay" onClick={() => setDetailComp(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
              <div>
                <span className={`comp-type ${COMP_CLASSES[detailComp.type]}`} style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
                  {COMP_ICONS[detailComp.type]} {COMP_TYPES[detailComp.type]}
                </span>
                <h3 style={{ margin: '0.5rem 0 0 0' }}>{detailComp.name}</h3>
              </div>
              <span className={`comp-status ${STATUS_CLASSES[detailComp.status]}`}>
                {STATUS_LABELS[detailComp.status]}
              </span>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {detailComp.description}
            </p>

            {/* Prize info */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🎁 Winner Receives:</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>🏠 Space NFT:</span>
                <span>{detailComp.rewardMode === 0 ? `New ${SPACE_TYPES[detailComp.mintSpaceType]} (${formatUSDC(detailComp.mintSpaceValue)} USDC value)` : `Space #${detailComp.stakedSpaceId}`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>💰 Prize Pool:</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatUSDC(detailComp.prizePool)} USDC</span>
              </div>
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Entry Fee</div>
                <div style={{ fontWeight: 600 }}>{formatUSDC(detailComp.entryFee)} USDC</div>
              </div>
              <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Participants</div>
                <div style={{ fontWeight: 600 }}>{detailComp.participantCount} / {detailComp.maxParticipants}</div>
              </div>
              <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Judge</div>
                <div style={{ fontWeight: 600 }}>{detailComp.judge.slice(0, 6)}...{detailComp.judge.slice(-4)}</div>
              </div>
              <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Duration</div>
                <div style={{ fontWeight: 600 }}>{detailComp.endTime ? `${Math.floor(detailComp.endTime / 3600)}h` : 'Open'}</div>
              </div>
            </div>

            {detailComp.status === 3 && detailComp.winner !== '0x0000000000000000000000000000000000000000' && (
              <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', marginBottom: '1rem', color: 'var(--success)', fontWeight: 600 }}>
                🏆 Winner: {detailComp.winner.slice(0, 8)}...{detailComp.winner.slice(-6)}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {detailComp.status === 0 && !detailComp.isJoined && (
                <button className="btn btn-primary" onClick={() => handleJoin(detailComp.id, detailComp.entryFee)}>
                  Join Competition ({formatUSDC(detailComp.entryFee)} USDC)
                </button>
              )}
              {detailComp.status === 0 && detailComp.isJoined && (
                <span className="badge badge-success" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>✓ You've Joined — Waiting for start</span>
              )}
              {detailComp.status === 1 && detailComp.isJoined && (
                <button className="btn btn-warning" onClick={() => { setSelectedComp(detailComp); }}>
                  Submit Your Solution
                </button>
              )}
              {detailComp.status === 1 && !detailComp.isJoined && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Competition in progress — you haven't joined</span>
              )}
              <button className="btn btn-secondary" onClick={() => setDetailComp(null)} style={{ marginLeft: 'auto' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Solution Submission Modal */}
      {selectedComp && (
        <div className="modal-overlay" onClick={() => setSelectedComp(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Submit Solution — {selectedComp.name}</h3>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Winner gets: 🏠 {selectedComp.rewardMode === 0 ? `New ${SPACE_TYPES[selectedComp.mintSpaceType]}` : `Space #${selectedComp.stakedSpaceId}`} + 💰 {formatUSDC(selectedComp.prizePool)} USDC
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

      {/* Create Competition Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Create New Competition</h3>
            <div className="form-group">
              <label className="form-label">Competition Type</label>
              <select className="form-input" value={newComp.type} onChange={(e) => setNewComp({ ...newComp, type: parseInt(e.target.value) })}>
                {COMP_TYPES.map((t, i) => <option key={i} value={i}>{COMP_ICONS[i]} {t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" placeholder="e.g. Chess Grand Prix #2" value={newComp.name}
                onChange={(e) => setNewComp({ ...newComp, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" rows="2" placeholder="Describe the rules and how to win..."
                value={newComp.desc} onChange={(e) => setNewComp({ ...newComp, desc: e.target.value })} style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Entry Fee (USDC)</label>
                <input className="form-input" type="number" placeholder="10" value={newComp.entryFee}
                  onChange={(e) => setNewComp({ ...newComp, entryFee: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Max Participants</label>
                <input className="form-input" type="number" min="2" placeholder="8" value={newComp.maxP}
                  onChange={(e) => setNewComp({ ...newComp, maxP: parseInt(e.target.value) || 2 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Prize Space Type</label>
                <select className="form-input" value={newComp.spaceType} onChange={(e) => setNewComp({ ...newComp, spaceType: parseInt(e.target.value) })}>
                  {SPACE_TYPES.map((t, i) => <option key={i} value={i}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Space Value (USDC)</label>
                <input className="form-input" type="number" placeholder="150" value={newComp.spaceValue}
                  onChange={(e) => setNewComp({ ...newComp, spaceValue: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Duration (hours)</label>
                <input className="form-input" type="number" min="1" placeholder="72" value={newComp.hours}
                  onChange={(e) => setNewComp({ ...newComp, hours: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn btn-primary" onClick={handleCreateCompetition}>Create Competition</button>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              Note: Only the contract owner can create competitions. You'll be set as the judge.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
