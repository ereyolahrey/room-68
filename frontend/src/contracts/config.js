// ARC Testnet Configuration
export const ARC_TESTNET = {
  chainId: 5042002,
  chainIdHex: '0x4CE4F2',
  name: 'ARC Testnet',
  rpcUrl: 'https://rpc.testnet.arc.network',
  wsUrl: 'wss://rpc.testnet.arc.network',
  explorer: 'https://testnet.arcscan.app',
  faucet: 'https://faucet.circle.com',
  currency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
};

// Contract addresses — update after deployment
export const CONTRACTS = {
  Room68Token: '',
  LivingSpaceNFT: '',
  LivingSpaceMarket: '',
  LendingPool: '',
  CompetitionManager: '',
  SwapBridge: '',
};

// Update these with your deployed addresses from deployment.json
export function updateContracts(addresses) {
  Object.assign(CONTRACTS, addresses);
}
