import { ethers } from 'ethers';
import { ARC_TESTNET, CONTRACTS } from '../contracts/config.js';
import {
  ERC20ABI,
  LivingSpaceNFTABI,
  LivingSpaceMarketABI,
  LendingPoolABI,
  CompetitionManagerABI,
  SwapBridgeABI,
} from '../contracts/abis.js';

const WALLET_KEY = 'room68_wallet_connected';
const ACTIVITY_KEY = 'room68_activity_log';
const MAX_ACTIVITIES = 500;

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('MetaMask not found. Please install MetaMask.');
  }

  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts',
  });

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_TESTNET.chainIdHex }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: ARC_TESTNET.chainIdHex,
            chainName: ARC_TESTNET.name,
            rpcUrls: [ARC_TESTNET.rpcUrl],
            nativeCurrency: ARC_TESTNET.currency,
            blockExplorerUrls: [ARC_TESTNET.explorer],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  localStorage.setItem(WALLET_KEY, 'true');
  logActivity('wallet', 'Wallet connected', { address: accounts[0] });

  return { provider, signer, address: accounts[0] };
}

export async function reconnectWallet() {
  if (!window.ethereum || localStorage.getItem(WALLET_KEY) !== 'true') return null;
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length === 0) return null;

    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== ARC_TESTNET.chainIdHex) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: ARC_TESTNET.chainIdHex }],
        });
      } catch {
        return null;
      }
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return { provider, signer, address: accounts[0] };
  } catch {
    return null;
  }
}

export function disconnectWallet() {
  localStorage.removeItem(WALLET_KEY);
  logActivity('wallet', 'Wallet disconnected');
}

export function getReadProvider() {
  return new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);
}

export function getContracts(signerOrProvider) {
  return {
    token: new ethers.Contract(CONTRACTS.USDC, ERC20ABI, signerOrProvider),
    spaceNFT: new ethers.Contract(CONTRACTS.LivingSpaceNFT, LivingSpaceNFTABI, signerOrProvider),
    market: new ethers.Contract(CONTRACTS.LivingSpaceMarket, LivingSpaceMarketABI, signerOrProvider),
    lending: new ethers.Contract(CONTRACTS.LendingPool, LendingPoolABI, signerOrProvider),
    competition: new ethers.Contract(CONTRACTS.CompetitionManager, CompetitionManagerABI, signerOrProvider),
    swap: new ethers.Contract(CONTRACTS.SwapBridge, SwapBridgeABI, signerOrProvider),
  };
}

export function shortenAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatUSDC(value) {
  return parseFloat(ethers.formatUnits(value, 6)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export function parseUSDC(value) {
  return ethers.parseUnits(value.toString(), 6);
}

export function getExplorerUrl(type, hash) {
  return `${ARC_TESTNET.explorer}/${type}/${hash}`;
}

// --- Activity Log ---
export function logActivity(category, message, data = {}) {
  try {
    const activities = getActivities();
    activities.unshift({
      id: Date.now(),
      category,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
    if (activities.length > MAX_ACTIVITIES) activities.length = MAX_ACTIVITIES;
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
  } catch { /* storage full — ignore */ }
}

export function getActivities() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearActivities() {
  localStorage.removeItem(ACTIVITY_KEY);
}
