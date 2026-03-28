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

// Contract addresses — deployed on ARC Testnet (v2 — 68 cap, rentals, NFT collateral, dual prizes)
export const CONTRACTS = {
  Room68Token: '0x6870EdC92a75D7cCbf5378c03eaDA56d02a64359',
  LivingSpaceNFT: '0xC141f6a45e31F6Bf0dE669c65Abb02ABfaa3F4E4',
  LivingSpaceMarket: '0xBe250b36561bE4D878fdec4A8fE0AB2754DF52B8',
  LendingPool: '0x3d541CcBAeb8Be8f5DE83562C3f0e23c67f62c68',
  CompetitionManager: '0x6a2Cb42c69920cA0e4a52Ee1c815a5568Ea7B7C9',
  SwapBridge: '0x056Dfa7beDd816D804dDd9F08862251FcaaEebc5',
};

// Update these with your deployed addresses from deployment.json
export function updateContracts(addresses) {
  Object.assign(CONTRACTS, addresses);
}
