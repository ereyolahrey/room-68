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

// Contract addresses — deployed on ARC Testnet
export const CONTRACTS = {
  Room68Token: '0x9B7a4bBc697a45A6eB3583e7BD24AF81FD10FeBa',
  LivingSpaceNFT: '0xC515a218c1b624C012DD642b2F7e82def8bA443c',
  LivingSpaceMarket: '0xb1a994f5DC20C64C5f1a9ea6d4652890f85Cb658',
  LendingPool: '0x6E25155db58bA82a1BC1C7B544ecd2A45766f593',
  CompetitionManager: '0xE0cE125ab470a4f75C66bF0683Cc6dE706d13E97',
  SwapBridge: '0xF1aD403595139c0c68A39E6eB2B264aCa36d57eB',
};

// Update these with your deployed addresses from deployment.json
export function updateContracts(addresses) {
  Object.assign(CONTRACTS, addresses);
}
