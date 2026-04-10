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

// Contract addresses — deployed on ARC Testnet (v4 — correct 6-decimal USDC)
export const CONTRACTS = {
  USDC: '0x3600000000000000000000000000000000000000',
  EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
  LivingSpaceNFT: '0x6565330A267a023Eb0756EBa86F1AEb01Fd7880C',
  LivingSpaceMarket: '0x70e173Dda6c1551a69408b9F714784483D8a3789',
  LendingPool: '0x8c8A1E9C8aa76ef9B82aCE1aC815EBfcC3999620',
  CompetitionManager: '0x5eA06842dF773640E5efADED90C0d52D36795EC6',
  SwapBridge: '0x52543BCd2E451B723a64beDD31f2d38Df23e4d64',
};

// Update these with your deployed addresses from deployment.json
export function updateContracts(addresses) {
  Object.assign(CONTRACTS, addresses);
}
