import React, { useState, useEffect } from 'react';

const AGENT_TYPES = [
  { value: 'ai', label: '🤖 AI Agent', desc: 'Automated agent with programmatic strategy' },
  { value: 'hybrid', label: '🧬 Hybrid', desc: 'AI-assisted human player' },
  { value: 'human', label: '🧑 Human Player', desc: 'Manual gameplay, no AI assistance' },
];

const SPECIALTIES = ['Chess', 'Crossword', 'Scrabble', 'Dancing', 'Music', 'Market Insight', 'All-Rounder'];

const STORAGE_KEY = 'room68_agents';

function loadAgents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

function saveAgents(agents) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

export default function AgentRegistry({ wallet, showToast }) {
  const [agents, setAgents] = useState([]);
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'ai', specialty: 'All-Rounder', description: '', avatar: '' });
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setAgents(loadAgents());
  }, []);

  function handleRegister() {
    if (!wallet) return showToast('Connect wallet first', 'error');
    if (!form.name.trim()) return showToast('Agent name is required', 'error');
    if (form.name.length > 30) return showToast('Name must be 30 characters or less', 'error');

    const existing = agents.find(a => a.wallet === wallet.address);
    if (existing) return showToast('This wallet already has a registered agent', 'error');

    const newAgent = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: form.name.trim(),
      type: form.type,
      specialty: form.specialty,
      description: form.description.trim().slice(0, 200),
      wallet: wallet.address,
      avatar: form.avatar || getDefaultAvatar(form.type),
      registeredAt: Date.now(),
      wins: 0,
      gamesPlayed: 0,
      totalScore: 0,
      elo: 1000,
    };

    const updated = [newAgent, ...agents];
    setAgents(updated);
    saveAgents(updated);
    setShowRegister(false);
    setForm({ name: '', type: 'ai', specialty: 'All-Rounder', description: '', avatar: '' });
    showToast(`Agent "${newAgent.name}" registered!`, 'success');
  }

  function getDefaultAvatar(type) {
    if (type === 'ai') return '🤖';
    if (type === 'hybrid') return '🧬';
    return '🧑';
  }

  function getMyAgent() {
    if (!wallet) return null;
    return agents.find(a => a.wallet === wallet.address);
  }

  function updateAgentStats(agentWallet, stats) {
    setAgents(prev => {
      const updated = prev.map(a =>
        a.wallet === agentWallet ? { ...a, ...stats } : a
      );
      saveAgents(updated);
      return updated;
    });
  }

  const myAgent = getMyAgent();
  const filteredAgents = filter === 'all' ? agents :
    filter === 'mine' ? agents.filter(a => a.wallet === wallet?.address) :
    agents.filter(a => a.type === filter);

  const leaderboard = [...agents].sort((a, b) => b.elo - a.elo).slice(0, 10);

  return (
    <div>
      {/* Hero / My Agent Card */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        {myAgent ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <div style={{ fontSize: '3rem' }}>{myAgent.avatar}</div>
            <div>
              <h3 style={{ margin: 0 }}>{myAgent.name}</h3>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                <span>{AGENT_TYPES.find(t => t.value === myAgent.type)?.label}</span>
                <span>•</span>
                <span>ELO: {myAgent.elo}</span>
                <span>•</span>
                <span>{myAgent.wins}W / {myAgent.gamesPlayed}G</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{myAgent.description}</div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              Register your agent to compete in Room 68 competitions. AI agents, hybrid bots, and human players all welcome.
            </p>
          </div>
        )}
        {!myAgent && (
          <button className="btn btn-primary" onClick={() => setShowRegister(true)}>
            🤖 Register Agent
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Total Agents</div>
          <div className="stat-value accent">{agents.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">AI Agents</div>
          <div className="stat-value info">{agents.filter(a => a.type === 'ai').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Hybrid</div>
          <div className="stat-value warning">{agents.filter(a => a.type === 'hybrid').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Human</div>
          <div className="stat-value success">{agents.filter(a => a.type === 'human').length}</div>
        </div>
      </div>

      {/* Leaderboard + Agent List side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Leaderboard */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>🏆 Leaderboard</h3>
          {leaderboard.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No agents registered yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {leaderboard.map((agent, i) => (
                <div key={agent.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem', borderRadius: '6px',
                  background: i === 0 ? 'rgba(255,170,68,0.1)' : i === 1 ? 'rgba(192,192,192,0.08)' : i === 2 ? 'rgba(205,127,50,0.08)' : 'transparent',
                }}>
                  <span style={{ fontWeight: 700, width: '1.5rem', textAlign: 'center', color: i < 3 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <span style={{ fontSize: '1.2rem' }}>{agent.avatar}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{agent.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{agent.specialty}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.9rem' }}>{agent.elo}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{agent.wins}W</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Agents */}
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[
              { value: 'all', label: 'All' },
              { value: 'ai', label: '🤖 AI' },
              { value: 'hybrid', label: '🧬 Hybrid' },
              { value: 'human', label: '🧑 Human' },
              ...(wallet ? [{ value: 'mine', label: '⭐ Mine' }] : []),
            ].map(f => (
              <button key={f.value}
                className={`btn btn-sm ${filter === f.value ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>

          {filteredAgents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤖</div>
              <p>No agents found. Register the first one!</p>
            </div>
          ) : (
            <div className="grid-3">
              {filteredAgents.map(agent => (
                <div key={agent.id} className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '2rem' }}>{agent.avatar}</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{agent.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {AGENT_TYPES.find(t => t.value === agent.type)?.label}
                      </div>
                    </div>
                  </div>
                  {agent.description && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{agent.description}</p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div style={{ padding: '0.4rem', background: 'var(--bg-secondary)', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>ELO</div>
                      <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{agent.elo}</div>
                    </div>
                    <div style={{ padding: '0.4rem', background: 'var(--bg-secondary)', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Specialty</div>
                      <div style={{ fontWeight: 600 }}>{agent.specialty}</div>
                    </div>
                    <div style={{ padding: '0.4rem', background: 'var(--bg-secondary)', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Games</div>
                      <div style={{ fontWeight: 600 }}>{agent.gamesPlayed}</div>
                    </div>
                    <div style={{ padding: '0.4rem', background: 'var(--bg-secondary)', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Wins</div>
                      <div style={{ fontWeight: 600, color: 'var(--success)' }}>{agent.wins}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {agent.wallet.slice(0, 6)}...{agent.wallet.slice(-4)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Registration Modal */}
      {showRegister && (
        <div className="modal-overlay" onClick={() => setShowRegister(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 style={{ marginTop: 0 }}>🤖 Register Your Agent</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Your agent identity is tied to your wallet. One agent per wallet.
            </p>

            <div className="form-group">
              <label className="form-label">Agent Name</label>
              <input className="form-input" placeholder="e.g. AlphaRoom-68" maxLength={30}
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Agent Type</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {AGENT_TYPES.map(t => (
                  <label key={t.value} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem',
                    borderRadius: '6px', cursor: 'pointer',
                    background: form.type === t.value ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-secondary)',
                    border: `1px solid ${form.type === t.value ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                    <input type="radio" name="agentType" value={t.value} checked={form.type === t.value}
                      onChange={e => setForm({ ...form, type: e.target.value })}
                      style={{ display: 'none' }} />
                    <span style={{ fontSize: '1.2rem' }}>{t.label.split(' ')[0]}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Specialty</label>
              <select className="form-input" value={form.specialty}
                onChange={e => setForm({ ...form, specialty: e.target.value })}>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <textarea className="form-input" rows="2" maxLength={200}
                placeholder="Describe your agent's strategy or personality..."
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ resize: 'vertical' }} />
            </div>

            <div className="form-group">
              <label className="form-label">Avatar Emoji (optional)</label>
              <input className="form-input" placeholder="🤖" maxLength={4}
                value={form.avatar} onChange={e => setForm({ ...form, avatar: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button className="btn btn-primary" onClick={handleRegister}>Register Agent</button>
              <button className="btn btn-secondary" onClick={() => setShowRegister(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
