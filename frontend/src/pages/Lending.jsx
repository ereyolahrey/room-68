import React, { useState, useEffect } from 'react';
import { getContracts, getReadProvider, formatR68, parseR68 } from '../utils/wallet.js';
import { CONTRACTS } from '../contracts/config.js';

export default function Lending({ wallet, showToast }) {
  const [tab, setTab] = useState('offers'); // offers | borrow | myLoans
  const [offers, setOffers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [collateral, setCollateral] = useState('0');
  const [poolLiquidity, setPoolLiquidity] = useState('0');
  const [loading, setLoading] = useState(false);

  // Form state
  const [lendAmount, setLendAmount] = useState('');
  const [lendRate, setLendRate] = useState('1000'); // 10%
  const [lendMinDays, setLendMinDays] = useState('7');
  const [lendMaxDays, setLendMaxDays] = useState('30');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [borrowDays, setBorrowDays] = useState('14');

  useEffect(() => {
    loadData();
  }, [wallet]);

  async function loadData() {
    if (!CONTRACTS.LendingPool) return;
    setLoading(true);
    try {
      const provider = wallet?.signer || getReadProvider();
      const contracts = getContracts(provider);

      const totalOffers = await contracts.lending.nextOfferId();
      const totalLoans = await contracts.lending.nextLoanId();
      const liquidity = await contracts.lending.totalPoolLiquidity();
      setPoolLiquidity(formatR68(liquidity));

      if (wallet) {
        const col = await contracts.lending.collateralBalance(wallet.address);
        setCollateral(formatR68(col));
      }

      // Load offers
      const offerList = [];
      for (let i = 0; i < Number(totalOffers); i++) {
        const o = await contracts.lending.offers(i);
        if (o.active) {
          offerList.push({
            id: Number(o.id),
            lender: o.lender,
            amount: o.amount,
            remaining: o.remainingAmount,
            rateBps: Number(o.interestRateBps),
            minDuration: Number(o.minDuration) / 86400,
            maxDuration: Number(o.maxDuration) / 86400,
          });
        }
      }
      setOffers(offerList);

      // Load loans for current user
      if (wallet) {
        const loanList = [];
        for (let i = 0; i < Number(totalLoans); i++) {
          const l = await contracts.lending.loans(i);
          if (l.borrower === wallet.address || l.lender === wallet.address) {
            const interest = await contracts.lending.calculateInterest(i);
            loanList.push({
              id: Number(l.id),
              borrower: l.borrower,
              lender: l.lender,
              principal: l.principal,
              collateralAmt: l.collateral,
              rateBps: Number(l.interestRateBps),
              startTime: Number(l.startTime),
              duration: Number(l.duration) / 86400,
              interest,
              repaid: l.repaid,
              liquidated: l.liquidated,
              isMine: l.borrower === wallet.address,
            });
          }
        }
        setLoans(loanList);
      }
    } catch (err) {
      console.error('Failed to load lending data:', err);
    }
    setLoading(false);
  }

  async function handleDepositCollateral() {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const amount = parseR68(collateralAmount);
      const contracts = getContracts(wallet.signer);

      showToast('Approving tokens...', 'info');
      await (await contracts.token.approve(CONTRACTS.LendingPool, amount)).wait();

      showToast('Depositing collateral...', 'info');
      const tx = await contracts.lending.depositCollateral(amount);
      await tx.wait();

      showToast('Collateral deposited!', 'success');
      setCollateralAmount('');
      loadData();
    } catch (err) {
      showToast(`Failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handleCreateOffer() {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const amount = parseR68(lendAmount);
      const contracts = getContracts(wallet.signer);

      showToast('Approving tokens...', 'info');
      await (await contracts.token.approve(CONTRACTS.LendingPool, amount)).wait();

      showToast('Creating lending offer...', 'info');
      const tx = await contracts.lending.createOffer(
        amount, parseInt(lendRate), parseInt(lendMinDays), parseInt(lendMaxDays)
      );
      await tx.wait();

      showToast('Lending offer created!', 'success');
      setLendAmount('');
      loadData();
    } catch (err) {
      showToast(`Failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handleBorrow(offerId) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const amount = parseR68(borrowAmount);
      const contracts = getContracts(wallet.signer);

      showToast('Borrowing...', 'info');
      const tx = await contracts.lending.borrow(offerId, amount, parseInt(borrowDays));
      await tx.wait();

      showToast('Loan created!', 'success');
      setBorrowAmount('');
      loadData();
    } catch (err) {
      showToast(`Failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handleRepay(loanId) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const contracts = getContracts(wallet.signer);
      const loan = await contracts.lending.loans(loanId);
      const interest = await contracts.lending.calculateInterest(loanId);
      const total = loan.principal + interest;

      showToast('Approving repayment...', 'info');
      await (await contracts.token.approve(CONTRACTS.LendingPool, total)).wait();

      showToast('Repaying loan...', 'info');
      const tx = await contracts.lending.repayLoan(loanId);
      await tx.wait();

      showToast('Loan repaid! Collateral returned.', 'success');
      loadData();
    } catch (err) {
      showToast(`Failed: ${err.reason || err.message}`, 'error');
    }
  }

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Pool Liquidity</div>
          <div className="stat-value success">{poolLiquidity} R68</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your Collateral</div>
          <div className="stat-value info">{collateral} R68</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Offers</div>
          <div className="stat-value accent">{offers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your Loans</div>
          <div className="stat-value warning">{loans.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { key: 'offers', label: '📄 Lending Offers' },
          { key: 'lend', label: '💰 Lend' },
          { key: 'borrow', label: '🏦 Borrow' },
          { key: 'myLoans', label: '📋 My Loans' },
        ].map((t) => (
          <button
            key={t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Offers Tab */}
      {tab === 'offers' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Available Lending Offers</h3>
          </div>
          {offers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No active offers. Be the first to lend!</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Lender</th>
                    <th>Available</th>
                    <th>Rate</th>
                    <th>Duration</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id}>
                      <td>{o.lender.slice(0, 6)}...{o.lender.slice(-4)}</td>
                      <td>{formatR68(o.remaining)} R68</td>
                      <td>{(o.rateBps / 100).toFixed(1)}% APR</td>
                      <td>{o.minDuration}-{o.maxDuration} days</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => { setTab('borrow'); }}>
                          Borrow
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Lend Tab */}
      {tab === 'lend' && (
        <div className="grid-2">
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>Create Lending Offer</h3>
            <div className="form-group">
              <label className="form-label">Amount (R68)</label>
              <input className="form-input" type="number" value={lendAmount} onChange={(e) => setLendAmount(e.target.value)} placeholder="Amount to lend" />
            </div>
            <div className="form-group">
              <label className="form-label">Interest Rate (basis points, 500-3000)</label>
              <input className="form-input" type="number" value={lendRate} onChange={(e) => setLendRate(e.target.value)} min="500" max="3000" />
              <small style={{ color: 'var(--text-muted)' }}>{(parseInt(lendRate || 0) / 100).toFixed(1)}% APR</small>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Min Days</label>
                <input className="form-input" type="number" value={lendMinDays} onChange={(e) => setLendMinDays(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Max Days</label>
                <input className="form-input" type="number" value={lendMaxDays} onChange={(e) => setLendMaxDays(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary btn-full" onClick={handleCreateOffer}>Create Offer</button>
          </div>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>How Lending Works</h3>
            <ul style={{ lineHeight: 2, color: 'var(--text-secondary)', fontSize: '0.9rem', paddingLeft: '1.25rem' }}>
              <li>You deposit R68 tokens into a lending offer</li>
              <li>Set your interest rate (5-30% APR)</li>
              <li>Borrowers need 150% collateral to borrow</li>
              <li>Interest accrues linearly over the loan period</li>
              <li>If the borrower defaults, you get their collateral</li>
              <li>Cancel your offer anytime if not fully borrowed</li>
            </ul>
          </div>
        </div>
      )}

      {/* Borrow Tab */}
      {tab === 'borrow' && (
        <div className="grid-2">
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>Deposit Collateral</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Current collateral: <strong style={{ color: 'var(--info)' }}>{collateral} R68</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Amount (R68)</label>
              <input className="form-input" type="number" value={collateralAmount} onChange={(e) => setCollateralAmount(e.target.value)} placeholder="Collateral amount" />
            </div>
            <button className="btn btn-success btn-full" onClick={handleDepositCollateral}>Deposit Collateral</button>
          </div>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>Borrow from Offer</h3>
            {offers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No offers available to borrow from.</p>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Select Offer</label>
                  <select className="form-select" id="offerSelect">
                    {offers.map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.id} — {formatR68(o.remaining)} R68 @ {(o.rateBps / 100).toFixed(1)}% APR
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Borrow Amount (R68)</label>
                  <input className="form-input" type="number" value={borrowAmount} onChange={(e) => setBorrowAmount(e.target.value)} placeholder="Amount to borrow" />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (days)</label>
                  <input className="form-input" type="number" value={borrowDays} onChange={(e) => setBorrowDays(e.target.value)} min="1" max="365" />
                </div>
                <button className="btn btn-primary btn-full" onClick={() => {
                  const select = document.getElementById('offerSelect');
                  handleBorrow(parseInt(select.value));
                }}>Borrow</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* My Loans Tab */}
      {tab === 'myLoans' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">My Loans</h3>
          </div>
          {!wallet ? (
            <p style={{ color: 'var(--text-muted)' }}>Connect wallet to view loans.</p>
          ) : loans.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No loans found.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Role</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Rate</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l) => (
                    <tr key={l.id}>
                      <td>#{l.id}</td>
                      <td>
                        <span className={`badge ${l.isMine ? 'badge-warning' : 'badge-success'}`}>
                          {l.isMine ? 'Borrower' : 'Lender'}
                        </span>
                      </td>
                      <td>{formatR68(l.principal)} R68</td>
                      <td>{formatR68(l.interest)} R68</td>
                      <td>{(l.rateBps / 100).toFixed(1)}%</td>
                      <td>
                        {l.repaid ? (
                          <span className="badge badge-success">Repaid</span>
                        ) : l.liquidated ? (
                          <span className="badge badge-danger">Liquidated</span>
                        ) : (
                          <span className="badge badge-info">Active</span>
                        )}
                      </td>
                      <td>
                        {l.isMine && !l.repaid && !l.liquidated && (
                          <button className="btn btn-success btn-sm" onClick={() => handleRepay(l.id)}>
                            Repay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
