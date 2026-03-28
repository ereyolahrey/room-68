import React, { useState, useEffect } from 'react';
import { getActivities, clearActivities } from '../utils/wallet.js';

const CATEGORY_ICONS = {
  wallet: '🔗',
  marketplace: '🏠',
  competition: '🏆',
  lending: '💰',
  swap: '🔄',
  rental: '🏘️',
  space: '🔑',
};

const CATEGORY_COLORS = {
  wallet: 'info',
  marketplace: 'success',
  competition: 'warning',
  lending: 'accent',
  swap: 'info',
  rental: 'success',
  space: 'warning',
};

export default function ActivityLog({ wallet, showToast }) {
  const [activities, setActivities] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setActivities(getActivities());
  }, []);

  function handleClear() {
    clearActivities();
    setActivities([]);
    showToast('Activity log cleared', 'info');
  }

  const filtered = filter === 'all' ? activities : activities.filter(a => a.category === filter);
  const categories = ['all', ...new Set(activities.map(a => a.category))];

  function formatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Your activity history is stored locally in your browser and persists across sessions.
          All on-chain data (spaces, loans, competitions) is permanent on the ARC Network blockchain.
        </p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Total Activities</div>
          <div className="stat-value accent">{activities.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Wallet Events</div>
          <div className="stat-value info">{activities.filter(a => a.category === 'wallet').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Transactions</div>
          <div className="stat-value success">{activities.filter(a => a.category !== 'wallet').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Storage</div>
          <div className="stat-value warning">Local</div>
        </div>
      </div>

      {/* Filter + Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`btn btn-sm ${filter === cat ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(cat)}
            >
              {cat === 'all' ? '📋 All' : `${CATEGORY_ICONS[cat] || '📌'} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
            </button>
          ))}
        </div>
        {activities.length > 0 && (
          <button className="btn btn-sm btn-danger" onClick={handleClear}>Clear Log</button>
        )}
      </div>

      {/* Activity List */}
      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📜</div>
            <p>No activities recorded yet. Connect your wallet and start using Room 68!</p>
          </div>
        ) : (
          <div>
            {filtered.map((a) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '0.75rem 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '1.25rem', marginTop: '0.1rem' }}>
                  {CATEGORY_ICONS[a.category] || '📌'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem' }}>{a.message}</div>
                  {a.data?.txHash && (
                    <a
                      href={`https://testnet.arcscan.app/tx/${a.data.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.8rem' }}
                    >
                      View Tx ↗
                    </a>
                  )}
                  {a.data?.address && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {a.data.address.slice(0, 10)}...{a.data.address.slice(-6)}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatTime(a.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
