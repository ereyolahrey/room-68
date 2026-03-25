import { ethers } from 'ethers';
import { ARC_TESTNET, CONTRACTS } from '../contracts/config.js';
import {
  Room68TokenABI,
  LivingSpaceNFTABI,
  LivingSpaceMarketABI,
  LendingPoolABI,
  CompetitionManagerABI,
  SwapBridgeABI,
} from '../contracts/abis.js';

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('MetaMask not found. Please install MetaMask.');
  }

  // Request accounts
  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts',
  });

  // Switch to ARC Testnet
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_TESTNET.chainIdHex }],
    });
  } catch (switchError) {
    // Chain not added yet — add it
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

  return { provider, signer, address: accounts[0] };
}

export function getReadProvider() {
  return new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);
}

export function getContracts(signerOrProvider) {
  return {
    token: new ethers.Contract(CONTRACTS.Room68Token, Room68TokenABI, signerOrProvider),
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

export function formatR68(value) {
  return parseFloat(ethers.formatEther(value)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export function parseR68(value) {
  return ethers.parseEther(value.toString());
}

export function getExplorerUrl(type, hash) {
  return `${ARC_TESTNET.explorer}/${type}/${hash}`;
}
