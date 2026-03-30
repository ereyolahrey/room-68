import React, { useState, useCallback, useEffect, useRef } from 'react';
import { connectWallet, reconnectWallet, disconnectWallet, shortenAddress, getContracts, formatUSDC, getReadProvider, logActivity } from './utils/wallet.js';
import { ARC_TESTNET, CONTRACTS } from './contracts/config.js';
import Dashboard from './pages/Dashboard.jsx';
import Marketplace from './pages/Marketplace.jsx';
import Competitions from './pages/Competitions.jsx';
import Lending from './pages/Lending.jsx';
import SwapBridgePage from './pages/SwapBridge.jsx';
import MySpaces from './pages/MySpaces.jsx';
import ActivityLog from './pages/ActivityLog.jsx';
import AgentRegistry from './pages/AgentRegistry.jsx';

const PAGES = {
  dashboard: { label: 'Dashboard', icon: '📊', component: Dashboard },
  marketplace: { label: 'Marketplace', icon: '🏠', component: Marketplace },
  myspaces: { label: 'My Spaces', icon: '🔑', component: MySpaces },
  agents: { label: 'Agent Registry', icon: '🤖', component: AgentRegistry },
  competitions: { label: 'Competitions', icon: '🏆', component: Competitions },
  lending: { label: 'Lending', icon: '💰', component: Lending },
  swap: { label: 'Swap & Bridge', icon: '🔄', component: SwapBridgePage },
  activity: { label: 'Activity', icon: '📜', component: ActivityLog },
};

const NAV_SECTIONS = [
  { title: 'Overview', items: ['dashboard'] },
  { title: 'Living Spaces', items: ['marketplace', 'myspaces'] },
  { title: 'Compete & Earn', items: ['agents', 'competitions'] },
  { title: 'Finance', items: ['lending', 'swap'] },
  { title: 'Account', items: ['activity'] },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState('0');
  const [toast, setToast] = useState(null);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletMenuRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadBalance = useCallback(async (w) => {
    if (CONTRACTS.USDC && w) {
      try {
        const contracts = getContracts(w.signer);
        const bal = await contracts.token.balanceOf(w.address);
        setBalance(formatUSDC(bal));
      } catch { setBalance('0'); }
    }
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      const w = await connectWallet();
      setWallet(w);
      showToast('Wallet connected to ARC Testnet!', 'success');
      loadBalance(w);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast, loadBalance]);

  const handleDisconnect = useCallback(() => {
    disconnectWallet();
    setWallet(null);
    setBalance('0');
    setWalletMenuOpen(false);
    showToast('Wallet disconnected', 'info');
  }, [showToast]);

  // Auto-reconnect on page load
  useEffect(() => {
    reconnectWallet().then((w) => {
      if (w) {
        setWallet(w);
        loadBalance(w);
      }
    });
  }, [loadBalance]);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
        setWallet(null);
        setBalance('0');
      } else {
        handleConnect();
      }
    };
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', () => window.location.reload());
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [handleConnect]);

  // Close wallet menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(e.target)) {
        setWalletMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Refresh balance every 30s when connected
  useEffect(() => {
    if (!wallet) return;
    const interval = setInterval(() => loadBalance(wallet), 30000);
    return () => clearInterval(interval);
  }, [wallet, loadBalance]);

  const PageComponent = PAGES[page]?.component || Dashboard;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🏛️</span>
          <h1>Room 68</h1>
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section) => (
            <div className="nav-section" key={section.title}>
              <div className="nav-section-title">{section.title}</div>
              {section.items.map((key) => (
                <div
                  key={key}
                  className={`nav-item ${page === key ? 'active' : ''}`}
                  onClick={() => setPage(key)}
                >
                  <span className="icon">{PAGES[key].icon}</span>
                  {PAGES[key].label}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* Wallet info in sidebar */}
        {wallet && (
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Connected
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{shortenAddress(wallet.address)}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>{balance} USDC</div>
            <button className="btn btn-sm btn-secondary" style={{ width: '100%', fontSize: '0.75rem' }} onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="header">
          <h2>{PAGES[page]?.icon} {PAGES[page]?.label}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <a href={ARC_TESTNET.faucet} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
              🚰 Faucet
            </a>
            {!wallet ? (
              <button className="wallet-btn" onClick={handleConnect}>
                🔗 Connect Wallet
              </button>
            ) : (
              <div style={{ position: 'relative' }} ref={walletMenuRef}>
                <button
                  className="wallet-btn connected"
                  onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                >
                  {shortenAddress(wallet.address)} ▾
                </button>
                {walletMenuOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: '8px', overflow: 'hidden', minWidth: '200px', zIndex: 200,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Balance</div>
                      <div style={{ color: 'var(--accent)', fontWeight: 600 }}>{balance} USDC</div>
                    </div>
                    <a href={`${ARC_TESTNET.explorer}/address/${wallet.address}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', padding: '0.6rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                      onClick={() => setWalletMenuOpen(false)}>
                      View on Explorer ↗
                    </a>
                    <div
                      style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', color: 'var(--danger)', cursor: 'pointer', borderTop: '1px solid var(--border)' }}
                      onClick={handleDisconnect}
                    >
                      Disconnect Wallet
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="network-banner">
          <span className="network-dot"></span>
          <strong>ARC Testnet</strong> — Chain ID: {ARC_TESTNET.chainId} — All transactions settled on ARC Network
          <a href={ARC_TESTNET.explorer} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto' }}>
            Explorer ↗
          </a>
        </div>

        <PageComponent wallet={wallet} showToast={showToast} />
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
