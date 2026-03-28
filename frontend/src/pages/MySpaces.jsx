import React, { useState, useEffect } from 'react';
import { getContracts, formatR68, parseR68, logActivity } from '../utils/wallet.js';
import { CONTRACTS } from '../contracts/config.js';

const SPACE_TYPES = ['Studio', 'Apartment', 'Penthouse', 'Mansion', 'Estate'];
const SPACE_ICONS = ['🏢', '🏬', '🌆', '🏰', '🏛️'];

export default function MySpaces({ wallet, showToast }) {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listModal, setListModal] = useState(null);
  const [rentModal, setRentModal] = useState(null);
  const [listPrice, setListPrice] = useState('');
  const [rentPrice, setRentPrice] = useState('');
  const [rentDeposit, setRentDeposit] = useState('');
  const [rentMinMonths, setRentMinMonths] = useState('1');
  const [rentMaxMonths, setRentMaxMonths] = useState('6');
  const [tab, setTab] = useState('owned');

  // Rental listing browsing
  const [rentalListings, setRentalListings] = useState([]);
  const [rentMonths, setRentMonths] = useState('3');

  // My active rentals (as tenant)
  const [myRentals, setMyRentals] = useState([]);

  useEffect(() => {
    if (wallet) loadMySpaces();
    loadRentalListings();
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

      // Load rentals where user is tenant
      const totalRentals = await contracts.spaceNFT.nextRentalId();
      const tenantRentals = [];
      for (let i = 0; i < Number(totalRentals); i++) {
        const r = await contracts.spaceNFT.rentals(i);
        if (r.active && r.tenant === wallet.address) {
          const space = await contracts.spaceNFT.getSpace(Number(r.tokenId));
          tenantRentals.push({
            rentalId: i,
            tokenId: Number(r.tokenId),
            spaceName: space.name,
            spaceType: Number(space.spaceType),
            landlord: r.landlord,
            monthlyRent: r.monthlyRent,
            deposit: r.deposit,
            endTime: Number(r.endTime),
            lastRentPaid: Number(r.lastRentPaid),
          });
        }
      }
      setMyRentals(tenantRentals);
    } catch (err) {
      console.error('Failed to load spaces:', err);
    }
    setLoading(false);
  }

  async function loadRentalListings() {
    if (!CONTRACTS.LivingSpaceNFT) return;
    try {
      const contracts = getContracts(wallet?.signer || (await import('../utils/wallet.js')).getReadProvider());
      const ids = await contracts.spaceNFT.getActiveRentalListings();
      const listings = [];
      for (const tokenId of ids) {
        const listing = await contracts.spaceNFT.rentalListings(tokenId);
        if (listing.active) {
          const space = await contracts.spaceNFT.getSpace(Number(tokenId));
          listings.push({
            tokenId: Number(tokenId),
            spaceName: space.name,
            spaceType: Number(space.spaceType),
            value: space.value,
            landlord: listing.landlord,
            monthlyRent: listing.monthlyRent,
            deposit: listing.deposit,
            minMonths: Number(listing.minMonths),
            maxMonths: Number(listing.maxMonths),
          });
        }
      }
      setRentalListings(listings);
    } catch (err) {
      console.error('Failed to load rental listings:', err);
    }
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

      logActivity('marketplace', `Listed space #${tokenId} for sale`, { txHash: receipt.hash });
      showToast(`Space listed! Tx: ${receipt.hash.slice(0, 10)}...`, 'success');
      setListModal(null);
      setListPrice('');
      loadMySpaces();
    } catch (err) {
      showToast(`Listing failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handleListForRent(tokenId) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const contracts = getContracts(wallet.signer);
      showToast('Listing space for rent...', 'info');
      const tx = await contracts.spaceNFT.listForRent(
        tokenId,
        parseR68(rentPrice),
        parseR68(rentDeposit),
        parseInt(rentMinMonths),
        parseInt(rentMaxMonths)
      );
      await tx.wait();
      logActivity('rental', `Listed space #${tokenId} for rent`);
      showToast('Space listed for rent!', 'success');
      setRentModal(null);
      setRentPrice('');
      setRentDeposit('');
      loadMySpaces();
      loadRentalListings();
    } catch (err) {
      showToast(`Failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handleRentSpace(tokenId, deposit, monthlyRent) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const contracts = getContracts(wallet.signer);
      const totalUpfront = deposit + monthlyRent;
      showToast('Approving R68 for deposit + first month...', 'info');
      await (await contracts.token.approve(CONTRACTS.LivingSpaceNFT, totalUpfront)).wait();
      showToast('Renting space...', 'info');
      const tx = await contracts.spaceNFT.rentSpace(tokenId, parseInt(rentMonths));
      await tx.wait();
      logActivity('rental', `Rented space #${tokenId}`);
      showToast('Space rented!', 'success');
      loadMySpaces();
      loadRentalListings();
    } catch (err) {
      showToast(`Failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handlePayRent(rentalId, monthlyRent) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const contracts = getContracts(wallet.signer);
      showToast('Approving rent payment...', 'info');
      await (await contracts.token.approve(CONTRACTS.LivingSpaceNFT, monthlyRent)).wait();
      showToast('Paying rent...', 'info');
      const tx = await contracts.spaceNFT.payRent(rentalId);
      await tx.wait();
      logActivity('rental', `Paid rent for rental #${rentalId}`);
      showToast('Rent paid!', 'success');
      loadMySpaces();
    } catch (err) {
      showToast(`Failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handleEndRental(rentalId) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const contracts = getContracts(wallet.signer);
      showToast('Ending rental...', 'info');
      const tx = await contracts.spaceNFT.endRental(rentalId);
      await tx.wait();
      logActivity('rental', `Ended rental #${rentalId}`);
      showToast('Rental ended! Deposit returned.', 'success');
      loadMySpaces();
    } catch (err) {
      showToast(`Failed: ${err.reason || err.message}`, 'error');
    }
  }

  const statusLabels = ['Available', 'Occupied', 'Listed', 'Locked', 'Rented', 'Collateralized'];
  const statusColors = ['success', 'info', 'warning', 'danger', 'accent', 'danger'];

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
          Manage your living space portfolio. Stack multiple spaces, list for sale or rent, use as loan collateral. Only 68 spaces exist.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { key: 'owned', label: '🏠 My Spaces' },
          { key: 'rentals', label: '🏘️ Rent a Space' },
          { key: 'myRentals', label: '📋 My Rentals' },
        ].map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* My Spaces Tab */}
      {tab === 'owned' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading your spaces...</div>
          ) : spaces.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏚️</div>
              <p>You don't own any living spaces yet. Buy from the marketplace, rent one, or win in competitions!</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                You own <strong style={{ color: 'var(--accent)' }}>{spaces.length}</strong> space{spaces.length !== 1 ? 's' : ''} (stacking!)
              </div>
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
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => setListModal(s)} style={{ flex: 1 }}>
                            Sell
                          </button>
                          <button className="btn btn-success btn-sm" onClick={() => setRentModal(s)} style={{ flex: 1 }}>
                            Rent Out
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Rent a Space Tab */}
      {tab === 'rentals' && (
        <div>
          {rentalListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏘️</div>
              <p>No spaces listed for rent right now.</p>
            </div>
          ) : (
            <div className="grid-3">
              {rentalListings.map((l) => (
                <div key={l.tokenId} className="space-card">
                  <div className="space-img">{SPACE_ICONS[l.spaceType] || '🏠'}</div>
                  <div className="space-body">
                    <div className="space-type">{SPACE_TYPES[l.spaceType]}</div>
                    <div className="space-name">{l.spaceName}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Landlord: {l.landlord.slice(0, 6)}...{l.landlord.slice(-4)}
                    </div>
                    <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      Rent: <strong>{formatR68(l.monthlyRent)} R68/mo</strong>
                    </div>
                    <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      Deposit: {formatR68(l.deposit)} R68
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      {l.minMonths}-{l.maxMonths} months
                    </div>
                    <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                      <input className="form-input" type="number" min={l.minMonths} max={l.maxMonths} value={rentMonths} onChange={(e) => setRentMonths(e.target.value)} placeholder="Months" style={{ fontSize: '0.85rem' }} />
                    </div>
                    <button className="btn btn-primary btn-sm btn-full" onClick={() => handleRentSpace(l.tokenId, l.deposit, l.monthlyRent)}>
                      Rent ({formatR68(l.deposit + l.monthlyRent)} R68 upfront)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Rentals Tab (as tenant) */}
      {tab === 'myRentals' && (
        <div>
          {myRentals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <p>You're not renting any spaces.</p>
            </div>
          ) : (
            <div className="grid-3">
              {myRentals.map((r) => (
                <div key={r.rentalId} className="space-card">
                  <div className="space-img">{SPACE_ICONS[r.spaceType] || '🏠'}</div>
                  <div className="space-body">
                    <div className="space-type">{SPACE_TYPES[r.spaceType]}</div>
                    <div className="space-name">{r.spaceName}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Landlord: {r.landlord.slice(0, 6)}...{r.landlord.slice(-4)}
                    </div>
                    <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      Rent: <strong>{formatR68(r.monthlyRent)} R68/mo</strong>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Ends: {new Date(r.endTime * 1000).toLocaleDateString()}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-success btn-sm" onClick={() => handlePayRent(r.rentalId, r.monthlyRent)} style={{ flex: 1 }}>
                        Pay Rent
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEndRental(r.rentalId)} style={{ flex: 1 }}>
                        End
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List for Sale Modal */}
      {listModal && (
        <div className="modal-overlay" onClick={() => setListModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>List Space for Sale</h3>
            <div style={{ marginBottom: '1rem' }}>
              <strong>{listModal.name}</strong> — {SPACE_TYPES[listModal.spaceType]}
            </div>
            <div className="form-group">
              <label className="form-label">Sale Price (R68)</label>
              <input className="form-input" type="number" placeholder="Price in R68 tokens" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={() => handleListSpace(listModal.id)}>List Space</button>
              <button className="btn btn-secondary" onClick={() => setListModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Rent Out Modal */}
      {rentModal && (
        <div className="modal-overlay" onClick={() => setRentModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>List Space for Rent</h3>
            <div style={{ marginBottom: '1rem' }}>
              <strong>{rentModal.name}</strong> — {SPACE_TYPES[rentModal.spaceType]}
            </div>
            <div className="form-group">
              <label className="form-label">Monthly Rent (R68)</label>
              <input className="form-input" type="number" placeholder="Rent per month" value={rentPrice} onChange={(e) => setRentPrice(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Security Deposit (R68)</label>
              <input className="form-input" type="number" placeholder="Deposit amount" value={rentDeposit} onChange={(e) => setRentDeposit(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Min Months</label>
                <input className="form-input" type="number" value={rentMinMonths} onChange={(e) => setRentMinMonths(e.target.value)} min="1" max="12" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Max Months</label>
                <input className="form-input" type="number" value={rentMaxMonths} onChange={(e) => setRentMaxMonths(e.target.value)} min="1" max="12" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-success" onClick={() => handleListForRent(rentModal.id)}>List for Rent</button>
              <button className="btn btn-secondary" onClick={() => setRentModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
