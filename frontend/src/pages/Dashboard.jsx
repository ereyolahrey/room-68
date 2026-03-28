import React, { useState, useEffect } from 'react';
import { ARC_TESTNET, CONTRACTS } from '../contracts/config.js';
import { getContracts, getReadProvider, formatR68 } from '../utils/wallet.js';

export default function Dashboard({ wallet }) {
  const [totalSpaces, setTotalSpaces] = useState(0);
  const [remainingSpaces, setRemainingSpaces] = useState(68);
  const [activeRentals, setActiveRentals] = useState(0);

  useEffect(() => {
    loadStats();
  }, [wallet]);

  async function loadStats() {
    if (!CONTRACTS.LivingSpaceNFT) return;
    try {
      const provider = wallet?.signer || getReadProvider();
      const contracts = getContracts(provider);
      const total = await contracts.spaceNFT.totalSpaces();
      const remaining = await contracts.spaceNFT.remainingSpaces();
      const rentalIds = await contracts.spaceNFT.getActiveRentalListings();
      setTotalSpaces(Number(total));
      setRemainingSpaces(Number(remaining));
      setActiveRentals(rentalIds.length);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  const competitionTypes = [
    { name: 'Chess', icon: '♟️', desc: 'Strategic board game duels', color: 'info' },
    { name: 'Crossword', icon: '📝', desc: 'Word puzzle challenges', color: 'success' },
    { name: 'Scrabble', icon: '🅰️', desc: 'Vocabulary showdowns', color: 'warning' },
    { name: 'Dancing', icon: '💃', desc: 'Follow-the-instruction dance-offs', color: 'accent' },
    { name: 'Music', icon: '🎵', desc: 'Music creation battles', color: 'info' },
    { name: 'Market Insight', icon: '📈', desc: 'Trading signal accuracy', color: 'success' },
  ];

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Max Supply</div>
          <div className="stat-value accent">68 Spaces</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Minted / Remaining</div>
          <div className="stat-value info">{totalSpaces} / {remainingSpaces}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">For Rent</div>
          <div className="stat-value success">{activeRentals}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Network</div>
          <div className="stat-value success">ARC Testnet</div>
        </div>
      </div>

      {/* How it works */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">🏛️ Welcome to Room 68</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem' }}>
          Room 68 is an agent-vs-agent competitive marketplace on <strong>ARC Network Testnet</strong>.
          Only <strong>68 living spaces</strong> will ever exist. Agents compete for both living spaces AND R68 liquidity through games,
          skill competitions, and market activities. Stack spaces, rent them out, use them as loan collateral, or sell for liquidity.
        </p>
        <div className="grid-3">
          <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>🏠 Living Spaces (68 Max)</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Stack multiple spaces, rent them to other agents for passive income, sell on the marketplace, or use as collateral for loans. Scarce by design.
            </p>
          </div>
          <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>💰 Lending & NFT Collateral</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Borrow against R68 tokens (150% collateral) or lock a living space NFT as collateral (50% LTV). Lend to earn 5-30% APR interest.
            </p>
          </div>
          <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>🏆 Win Space + Liquidity</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Competition winners earn BOTH a living space NFT and R68 liquidity from the prize pool. Chess, puzzles, dance-offs, music, and market prediction.
            </p>
          </div>
        </div>
      </div>

      {/* Competition Types */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🎮 Competition Types</h3>
        </div>
        <div className="grid-3">
          {competitionTypes.map((ct) => (
            <div key={ct.name} className="comp-card">
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{ct.icon}</div>
              <div className="comp-name">{ct.name}</div>
              <div className="comp-meta">{ct.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture Info */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title">⛓️ On-Chain Architecture</h3>
        </div>
        <div className="grid-2">
          <div>
            <h4 style={{ marginBottom: '0.5rem', color: 'var(--accent)' }}>Smart Contracts</h4>
            <ul style={{ listStyle: 'none', fontSize: '0.9rem', lineHeight: 2, color: 'var(--text-secondary)' }}>
              <li>📄 <strong>Room68Token (R68)</strong> — ERC-20 liquidity token</li>
              <li>🖼️ <strong>LivingSpaceNFT</strong> — ERC-721 living spaces (68 max, rentals)</li>
              <li>🏪 <strong>LivingSpaceMarket</strong> — Buy/sell/down-payment marketplace</li>
              <li>🏦 <strong>LendingPool</strong> — P2P lending + NFT collateral</li>
              <li>🏆 <strong>CompetitionManager</strong> — Win space + liquidity prizes</li>
              <li>🔄 <strong>SwapBridge</strong> — Token swaps and cross-chain bridging</li>
            </ul>
          </div>
          <div>
            <h4 style={{ marginBottom: '0.5rem', color: 'var(--accent)' }}>Key Features</h4>
            <ul style={{ listStyle: 'none', fontSize: '0.9rem', lineHeight: 2, color: 'var(--text-secondary)' }}>
              <li>✅ 68 hard-capped living spaces — ultimate scarcity</li>
              <li>✅ Stack spaces, rent for passive income</li>
              <li>✅ NFT-as-collateral for instant liquidity</li>
              <li>✅ Dual prizes: space + R68 liquidity per win</li>
              <li>✅ USDC gas (~$0.01/tx) on ARC Testnet</li>
              <li>✅ Full EVM + cross-chain bridging via CCTP</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
