import React, { useState, useEffect } from 'react';
import { getContracts, getReadProvider, formatR68, parseR68, logActivity } from '../utils/wallet.js';
import { CONTRACTS, ARC_TESTNET } from '../contracts/config.js';

export default function SwapBridgePage({ wallet, showToast }) {
  const [tab, setTab] = useState('swap');
  const [swapOrders, setSwapOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Swap form
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');

  // Bridge form
  const [bridgeChain, setBridgeChain] = useState('Ethereum Sepolia');
  const [bridgeAmount, setBridgeAmount] = useState('');

  useEffect(() => {
    loadOrders();
  }, [wallet]);

  async function loadOrders() {
    if (!CONTRACTS.SwapBridge) return;
    setLoading(true);
    try {
      const provider = wallet?.signer || getReadProvider();
      const contracts = getContracts(provider);
      const total = await contracts.swap.nextSwapOrderId();

      const orders = [];
      for (let i = 0; i < Number(total); i++) {
        const o = await contracts.swap.swapOrders(i);
        if (!o.filled && !o.cancelled) {
          orders.push({
            id: Number(o.id),
            maker: o.maker,
            fromToken: o.fromToken,
            toToken: o.toToken,
            fromAmount: o.fromAmount,
            toAmount: o.toAmount,
            createdAt: Number(o.createdAt),
          });
        }
      }
      setSwapOrders(orders);
    } catch (err) {
      console.error('Failed to load swap orders:', err);
    }
    setLoading(false);
  }

  async function handleCreateSwap() {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const contracts = getContracts(wallet.signer);
      const from = parseR68(fromAmount);
      const to = parseR68(toAmount);

      showToast('Approving tokens...', 'info');
      await (await contracts.token.approve(CONTRACTS.SwapBridge, from)).wait();

      showToast('Creating swap order...', 'info');
      const tx = await contracts.swap.createSwapOrder(
        CONTRACTS.Room68Token,
        CONTRACTS.Room68Token, // In production, this would be a different token
        from,
        to
      );
      await tx.wait();

      logActivity('swap', `Created swap order: ${fromAmount} → ${toAmount} R68`);
      showToast('Swap order created!', 'success');
      setFromAmount('');
      setToAmount('');
      loadOrders();
    } catch (err) {
      showToast(`Failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handleFillOrder(orderId) {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const contracts = getContracts(wallet.signer);
      const order = swapOrders.find(o => o.id === orderId);

      showToast('Approving tokens...', 'info');
      await (await contracts.token.approve(CONTRACTS.SwapBridge, order.toAmount)).wait();

      showToast('Filling swap order...', 'info');
      const tx = await contracts.swap.fillSwapOrder(orderId);
      await tx.wait();

      logActivity('swap', `Filled swap order #${orderId}`);
      showToast('Swap completed!', 'success');
      loadOrders();
    } catch (err) {
      showToast(`Failed: ${err.reason || err.message}`, 'error');
    }
  }

  async function handleBridge() {
    if (!wallet) return showToast('Connect wallet first', 'error');
    try {
      const contracts = getContracts(wallet.signer);
      const amount = parseR68(bridgeAmount);

      showToast('Approving tokens...', 'info');
      await (await contracts.token.approve(CONTRACTS.SwapBridge, amount)).wait();

      showToast('Initiating bridge...', 'info');
      const tx = await contracts.swap.initiateBridge(
        'ARC Testnet',
        bridgeChain,
        CONTRACTS.Room68Token,
        amount
      );
      await tx.wait();

      logActivity('swap', `Bridged ${bridgeAmount} R68 to ${bridgeChain}`);
      showToast(`Bridge initiated to ${bridgeChain}!`, 'success');
      setBridgeAmount('');
    } catch (err) {
      showToast(`Failed: ${err.reason || err.message}`, 'error');
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Swap tokens within Room 68 or bridge assets cross-chain using ARC Network's CCTP integration.
          0.3% swap fee applies.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button className={`btn ${tab === 'swap' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('swap')}>
          🔄 Token Swaps
        </button>
        <button className={`btn ${tab === 'bridge' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('bridge')}>
          🌉 Bridge
        </button>
        <button className={`btn ${tab === 'orders' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('orders')}>
          📋 Open Orders
        </button>
      </div>

      {/* Swap Tab */}
      {tab === 'swap' && (
        <div className="grid-2">
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>Create Swap Order</h3>
            <div className="form-group">
              <label className="form-label">You Send (R68)</label>
              <input className="form-input" type="number" value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} placeholder="Amount to send" />
            </div>
            <div style={{ textAlign: 'center', fontSize: '1.5rem', margin: '0.5rem 0' }}>⇅</div>
            <div className="form-group">
              <label className="form-label">You Receive (R68)</label>
              <input className="form-input" type="number" value={toAmount} onChange={(e) => setToAmount(e.target.value)} placeholder="Amount to receive" />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Fee: 0.3% • Limit order style — another agent fills your order
            </p>
            <button className="btn btn-primary btn-full" onClick={handleCreateSwap}>Create Swap Order</button>
          </div>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>Supported Assets</h3>
            <div style={{ lineHeight: 2.2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🪙</span>
                <div>
                  <div style={{ fontWeight: 600 }}>R68 Token</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Room 68 Liquidity Token</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>💵</span>
                <div>
                  <div style={{ fontWeight: 600 }}>USDC</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Native ARC gas token</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>💶</span>
                <div>
                  <div style={{ fontWeight: 600 }}>EURC</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Euro stablecoin on ARC</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bridge Tab */}
      {tab === 'bridge' && (
        <div className="grid-2">
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>🌉 Bridge Assets</h3>
            <div className="form-group">
              <label className="form-label">From</label>
              <input className="form-input" value="ARC Testnet" disabled />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <select className="form-select" value={bridgeChain} onChange={(e) => setBridgeChain(e.target.value)}>
                <option>Ethereum Sepolia</option>
                <option>Avalanche Fuji</option>
                <option>Polygon Amoy</option>
                <option>Base Sepolia</option>
                <option>Arbitrum Sepolia</option>
                <option>Solana Devnet</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount (R68)</label>
              <input className="form-input" type="number" value={bridgeAmount} onChange={(e) => setBridgeAmount(e.target.value)} placeholder="Amount to bridge" />
            </div>
            <button className="btn btn-primary btn-full" onClick={handleBridge}>Initiate Bridge</button>
          </div>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>Bridge Info</h3>
            <ul style={{ lineHeight: 2, color: 'var(--text-secondary)', fontSize: '0.9rem', paddingLeft: '1.25rem' }}>
              <li>Powered by Circle's CCTP (Cross-Chain Transfer Protocol)</li>
              <li>USDC transfers between ARC and other chains</li>
              <li>Tokens locked on source chain, minted on destination</li>
              <li>Settlement time varies by destination chain</li>
              <li>
                <a href="https://docs.arc.network/app-kit/bridge" target="_blank" rel="noopener noreferrer">
                  Learn more about ARC bridging ↗
                </a>
              </li>
            </ul>
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.85rem' }}>
              <strong>CCTP Contract:</strong><br />
              <code style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
                0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
              </code>
              <br /><small style={{ color: 'var(--text-muted)' }}>TokenMessengerV2 on ARC Testnet</small>
            </div>
          </div>
        </div>
      )}

      {/* Open Orders Tab */}
      {tab === 'orders' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Open Swap Orders</h3>
          </div>
          {swapOrders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No open swap orders.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Maker</th>
                    <th>Offering</th>
                    <th>Wants</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {swapOrders.map((o) => (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td>{o.maker.slice(0, 6)}...{o.maker.slice(-4)}</td>
                      <td>{formatR68(o.fromAmount)} R68</td>
                      <td>{formatR68(o.toAmount)} R68</td>
                      <td>
                        {wallet && o.maker.toLowerCase() !== wallet.address.toLowerCase() ? (
                          <button className="btn btn-success btn-sm" onClick={() => handleFillOrder(o.id)}>
                            Fill Order
                          </button>
                        ) : (
                          <span className="badge badge-info">Your Order</span>
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
