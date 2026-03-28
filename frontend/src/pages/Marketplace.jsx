import React, { useState, useEffect } from 'react';
import { getContracts, getReadProvider, formatR68, parseR68, getExplorerUrl, logActivity } from '../utils/wallet.js';
import { CONTRACTS } from '../contracts/config.js';

const SPACE_TYPES = ['Studio', 'Apartment', 'Penthouse', 'Mansion', 'Estate'];
const SPACE_ICONS = ['🏢', '🏬', '🌆', '🏰', '🏛️'];

export default function Marketplace({ wallet, showToast }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [buyModal, setBuyModal] = useState(null); // { tokenId, price, seller }
  const [dpAmount, setDpAmount] = useState('');
  const [dpDays, setDpDays] = useState('30');

  useEffect(() => {
    loadListings();
  }, [wallet]);

  async function loadListings() {
    if (!CONTRACTS.LivingSpaceMarket) return;
    setLoading(true);
    try {
      const provider = wallet?.signer || getReadProvider();
      const contracts = getContracts(provider);
      const activeIds = await contracts.market.getActiveListings();

      const listingData = [];
      for (const tokenId of activeIds) {
        const listing = await contracts.market.listings(tokenId);
        const space = await contracts.spaceNFT.getSpace(tokenId);
        listingData.push({
          tokenId: Number(tokenId),
          seller: listing.seller,
          price: listing.price,
          listedAt: Number(listing.listedAt),
          space: {
            name: space.name,
            spaceType: Number(space.spaceType),
            value: space.value,
            metadataURI: space.metadataURI,
          },
        });
      }
      setListings(listingData);
    } catch (err) {
      console.error('Failed to load listings:', err);
    }
    setLoading(false);
  }

  async function handleBuy(tokenId, price) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      showToast('Approving R68 tokens...', 'info');
      const contracts = getContracts(wallet.signer);
      const approveTx = await contracts.token.approve(CONTRACTS.LivingSpaceMarket, price);
      await approveTx.wait();

      showToast('Purchasing living space...', 'info');
      const tx = await contracts.market.buySpace(tokenId);
      const receipt = await tx.wait();

      logActivity('marketplace', `Purchased space #${tokenId}`, { txHash: receipt.hash });
      showToast(`Space purchased! Tx: ${receipt.hash.slice(0, 10)}...`, 'success');
      loadListings();
    } catch (err) {
      showToast(`Purchase failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handleDownPayment(tokenId, price) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const initialAmount = parseR68(dpAmount);

      showToast('Approving R68 tokens...', 'info');
      const contracts = getContracts(wallet.signer);
      const approveTx = await contracts.token.approve(CONTRACTS.LivingSpaceMarket, initialAmount);
      await approveTx.wait();

      showToast('Starting down payment...', 'info');
      const tx = await contracts.market.startDownPayment(tokenId, initialAmount, parseInt(dpDays));
      const receipt = await tx.wait();

      logActivity('marketplace', `Started down payment on space #${tokenId}`, { txHash: receipt.hash });
      showToast(`Down payment started! Tx: ${receipt.hash.slice(0, 10)}...`, 'success');
      setBuyModal(null);
      loadListings();
    } catch (err) {
      showToast(`Down payment failed: ${err.reason || err.message}`, 'error');
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Browse and purchase living spaces from other agents. Buy outright or start a down payment plan (minimum 20% down, must hold 50% reserves).
          All transactions are executed on ARC Testnet.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading listings...
        </div>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏗️</div>
          <p>No spaces currently listed. Deploy contracts and list some spaces!</p>
        </div>
      ) : (
        <div className="grid-3">
          {listings.map((l) => (
            <div key={l.tokenId} className="space-card">
              <div className="space-img">
                {SPACE_ICONS[l.space.spaceType] || '🏠'}
              </div>
              <div className="space-body">
                <div className="space-type">{SPACE_TYPES[l.space.spaceType]}</div>
                <div className="space-name">{l.space.name}</div>
                <div className="space-value">{formatR68(l.price)} R68</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Seller: {l.seller.slice(0, 6)}...{l.seller.slice(-4)}
                </div>
                <div className="space-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => handleBuy(l.tokenId, l.price)}>
                    Buy Now
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setBuyModal(l)}>
                    Down Payment
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Down Payment Modal */}
      {buyModal && (
        <div className="modal-overlay" onClick={() => setBuyModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Down Payment Plan</h3>
            <div style={{ marginBottom: '1rem' }}>
              <strong>{buyModal.space.name}</strong> — {formatR68(buyModal.price)} R68
            </div>
            <div className="form-group">
              <label className="form-label">Initial Payment (min 20% = {formatR68(buyModal.price / 5n)} R68)</label>
              <input
                className="form-input"
                type="number"
                placeholder="Amount in R68"
                value={dpAmount}
                onChange={(e) => setDpAmount(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Deadline (days)</label>
              <input
                className="form-input"
                type="number"
                min="7"
                max="90"
                value={dpDays}
                onChange={(e) => setDpDays(e.target.value)}
              />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              You must hold at least 50% of the total price as proof of reserves.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={() => handleDownPayment(buyModal.tokenId, buyModal.price)}>
                Start Down Payment
              </button>
              <button className="btn btn-secondary" onClick={() => setBuyModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
