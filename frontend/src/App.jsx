import React, { useState, useCallback, useEffect } from 'react';
import { connectWallet, shortenAddress, getContracts, formatR68, getReadProvider } from './utils/wallet.js';
import { ARC_TESTNET, CONTRACTS } from './contracts/config.js';
import Dashboard from './pages/Dashboard.jsx';
import Marketplace from './pages/Marketplace.jsx';
import Competitions from './pages/Competitions.jsx';
import Lending from './pages/Lending.jsx';
import SwapBridgePage from './pages/SwapBridge.jsx';
import MySpaces from './pages/MySpaces.jsx';

const PAGES = {
  dashboard: { label: 'Dashboard', icon: '📊', component: Dashboard },
  marketplace: { label: 'Marketplace', icon: '🏠', component: Marketplace },
  myspaces: { label: 'My Spaces', icon: '🔑', component: MySpaces },
  competitions: { label: 'Competitions', icon: '🏆', component: Competitions },
  lending: { label: 'Lending', icon: '💰', component: Lending },
  swap: { label: 'Swap & Bridge', icon: '🔄', component: SwapBridgePage },
};

const NAV_SECTIONS = [
  { title: 'Overview', items: ['dashboard'] },
  { title: 'Living Spaces', items: ['marketplace', 'myspaces'] },
  { title: 'Compete & Earn', items: ['competitions'] },
  { title: 'Finance', items: ['lending', 'swap'] },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState('0');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      const w = await connectWallet();
      setWallet(w);
      showToast('Wallet connected to ARC Testnet!', 'success');

      // Load R68 balance
      if (CONTRACTS.Room68Token) {
        const contracts = getContracts(w.signer);
        const bal = await contracts.token.balanceOf(w.address);
        setBalance(formatR68(bal));
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setWallet(null);
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
            <div style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>{balance} R68</div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="header">
          <h2>{PAGES[page]?.icon} {PAGES[page]?.label}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <a href={ARC_TESTNET.faucet} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
              🚰 Get Testnet USDC
            </a>
            <button
              className={`wallet-btn ${wallet ? 'connected' : ''}`}
              onClick={handleConnect}
            >
              {wallet ? `${shortenAddress(wallet.address)}` : '🔗 Connect Wallet'}
            </button>
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
