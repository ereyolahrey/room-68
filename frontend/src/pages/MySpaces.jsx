import React, { useState, useEffect } from 'react';
import { getContracts, formatR68, parseR68 } from '../utils/wallet.js';
import { CONTRACTS } from '../contracts/config.js';

const SPACE_TYPES = ['Studio', 'Apartment', 'Penthouse', 'Mansion', 'Estate'];
const SPACE_ICONS = ['🏢', '🏬', '🌆', '🏰', '🏛️'];

export default function MySpaces({ wallet, showToast }) {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listModal, setListModal] = useState(null);
  const [listPrice, setListPrice] = useState('');

  useEffect(() => {
    if (wallet) loadMySpaces();
  }, [wallet]);

  async function loadMySpaces() {
    if (!wallet || !CONTRACTS.LivingSpaceNFT) return;
    setLoading(true);
    try {
      const contracts = getContracts(wallet.signer);
      const tokenIds = await contracts.spaceNFT.getSpacesByOwner(wallet.address);

      const spaceData = [];
      for (const id of tokenIds) {
        const space = await contracts.spaceNFT.getSpace(id);
        spaceData.push({
          id: Number(id),
          name: space.name,
          spaceType: Number(space.spaceType),
          status: Number(space.status),
          value: space.value,
          createdAt: Number(space.createdAt),
        });
      }
      setSpaces(spaceData);
    } catch (err) {
      console.error('Failed to load spaces:', err);
    }
    setLoading(false);
  }

  async function handleListSpace(tokenId) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const price = parseR68(listPrice);
      const contracts = getContracts(wallet.signer);

      showToast('Approving NFT transfer...', 'info');
      const approveTx = await contracts.spaceNFT.approve(CONTRACTS.LivingSpaceMarket, tokenId);
      await approveTx.wait();

      showToast('Listing space on marketplace...', 'info');
      const tx = await contracts.market.listSpace(tokenId, price);
      const receipt = await tx.wait();

      showToast(`Space listed! Tx: ${receipt.hash.slice(0, 10)}...`, 'success');
      setListModal(null);
      setListPrice('');
      loadMySpaces();
    } catch (err) {
      showToast(`Listing failed: ${err.reason || err.message}`, 'error');
    }
  }

  const statusLabels = ['Available', 'Occupied', 'Listed', 'Locked'];
  const statusColors = ['success', 'info', 'warning', 'danger'];

  if (!wallet) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
        <p>Connect your wallet to view your living spaces.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Manage your living space portfolio. List spaces for sale on the marketplace, or hold them for value.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading your spaces...</div>
      ) : spaces.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏚️</div>
          <p>You don't own any living spaces yet. Buy some from the marketplace or win them in competitions!</p>
        </div>
      ) : (
        <div className="grid-3">
          {spaces.map((s) => (
            <div key={s.id} className="space-card">
              <div className="space-img">
                {SPACE_ICONS[s.spaceType] || '🏠'}
              </div>
              <div className="space-body">
                <div className="space-type">{SPACE_TYPES[s.spaceType]}</div>
                <div className="space-name">{s.name}</div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <span className={`badge badge-${statusColors[s.status]}`}>
                    {statusLabels[s.status]}
                  </span>
                </div>
                <div className="space-value">{formatR68(s.value)} R68</div>
                {s.status === 0 && (
                  <button className="btn btn-primary btn-sm btn-full" onClick={() => setListModal(s)}>
                    List for Sale
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List Modal */}
      {listModal && (
        <div className="modal-overlay" onClick={() => setListModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>List Space for Sale</h3>
            <div style={{ marginBottom: '1rem' }}>
              <strong>{listModal.name}</strong> — {SPACE_TYPES[listModal.spaceType]}
            </div>
            <div className="form-group">
              <label className="form-label">Sale Price (R68)</label>
              <input
                className="form-input"
                type="number"
                placeholder="Price in R68 tokens"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={() => handleListSpace(listModal.id)}>
                List Space
              </button>
              <button className="btn btn-secondary" onClick={() => setListModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
