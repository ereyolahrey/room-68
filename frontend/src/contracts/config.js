// ARC Testnet Configuration
export const ARC_TESTNET = {
  chainId: 5042002,
  chainIdHex: '0x4CEF52',
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

// Contract addresses — deployed on ARC Testnet (v3 — USDC/EURC, 68 cap, rentals, NFT collateral, dual prizes)
export const CONTRACTS = {
  USDC: '0x3600000000000000000000000000000000000000',
  EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
  LivingSpaceNFT: '0x1C6A6749e58F819ee4a20113E31261353e4bec54',
  LivingSpaceMarket: '0x2508142Bee0592DF9a5DbAB18998B61d42aD9Fb9',
  LendingPool: '0xEd6a9a6209B01010902Cfb6979A1aa8a20d0916C',
  CompetitionManager: '0x7F93411761C34a368320b8e6518941879c90Ec90',
  SwapBridge: '0x547242E0926F6437fb78b60a6847ABF8085c436D',
};

// Update these with your deployed addresses from deployment.json
export function updateContracts(addresses) {
  Object.assign(CONTRACTS, addresses);
}
