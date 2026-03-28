const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying Room 68 contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "USDC");

  // 1. Deploy Room68Token
  console.log("\n--- Deploying Room68Token ---");
  const Room68Token = await hre.ethers.getContractFactory("Room68Token");
  const r68Token = await Room68Token.deploy();
  await r68Token.waitForDeployment();
  const r68Address = await r68Token.getAddress();
  console.log("Room68Token deployed to:", r68Address);

  // 2. Deploy LivingSpaceNFT (requires r68Token for rental payments)
  console.log("\n--- Deploying LivingSpaceNFT ---");
  const LivingSpaceNFT = await hre.ethers.getContractFactory("LivingSpaceNFT");
  const spaceNFT = await LivingSpaceNFT.deploy(r68Address);
  await spaceNFT.waitForDeployment();
  const nftAddress = await spaceNFT.getAddress();
  console.log("LivingSpaceNFT deployed to:", nftAddress);

  // 3. Deploy LivingSpaceMarket
  console.log("\n--- Deploying LivingSpaceMarket ---");
  const LivingSpaceMarket = await hre.ethers.getContractFactory("LivingSpaceMarket");
  const market = await LivingSpaceMarket.deploy(r68Address, nftAddress);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log("LivingSpaceMarket deployed to:", marketAddress);

  // 4. Deploy LendingPool (requires spaceNFT for NFT collateral)
  console.log("\n--- Deploying LendingPool ---");
  const LendingPool = await hre.ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(r68Address, nftAddress);
  await lendingPool.waitForDeployment();
  const lendingAddress = await lendingPool.getAddress();
  console.log("LendingPool deployed to:", lendingAddress);

  // 5. Deploy CompetitionManager
  console.log("\n--- Deploying CompetitionManager ---");
  const CompetitionManager = await hre.ethers.getContractFactory("CompetitionManager");
  const competition = await CompetitionManager.deploy(r68Address, nftAddress);
  await competition.waitForDeployment();
  const competitionAddress = await competition.getAddress();
  console.log("CompetitionManager deployed to:", competitionAddress);

  // 6. Deploy SwapBridge
  console.log("\n--- Deploying SwapBridge ---");
  const SwapBridge = await hre.ethers.getContractFactory("SwapBridge");
  const swapBridge = await SwapBridge.deploy(r68Address);
  await swapBridge.waitForDeployment();
  const swapAddress = await swapBridge.getAddress();
  console.log("SwapBridge deployed to:", swapAddress);

  // 7. Configure permissions
  console.log("\n--- Configuring permissions ---");

  await spaceNFT.authorizeMarket(marketAddress);
  console.log("Market authorized on LivingSpaceNFT");

  await spaceNFT.authorizeMarket(competitionAddress);
  console.log("CompetitionManager authorized on LivingSpaceNFT");

  await spaceNFT.authorizeMarket(lendingAddress);
  console.log("LendingPool authorized on LivingSpaceNFT");

  await r68Token.addMinter(competitionAddress);
  console.log("CompetitionManager added as R68 minter");

  // 8. Mint initial living spaces (20 of 68 max — rest earned through competitions)
  console.log("\n--- Minting initial living spaces (20 of 68 max) ---");
  const initialSpaces = [
    { name: "Studio Alpha", type: 0, value: "100" },
    { name: "Studio Beta", type: 0, value: "120" },
    { name: "Studio Gamma", type: 0, value: "110" },
    { name: "Studio Delta", type: 0, value: "130" },
    { name: "Studio Epsilon", type: 0, value: "115" },
    { name: "Apartment Luxe", type: 1, value: "500" },
    { name: "Apartment Prime", type: 1, value: "600" },
    { name: "Apartment Nova", type: 1, value: "550" },
    { name: "Apartment Zen", type: 1, value: "650" },
    { name: "Apartment Vibe", type: 1, value: "580" },
    { name: "Apartment Sol", type: 1, value: "620" },
    { name: "Penthouse Sky", type: 2, value: "2000" },
    { name: "Penthouse Cloud", type: 2, value: "2200" },
    { name: "Penthouse Star", type: 2, value: "2500" },
    { name: "Penthouse Moon", type: 2, value: "1800" },
    { name: "Mansion Grand", type: 3, value: "5000" },
    { name: "Mansion Noble", type: 3, value: "5500" },
    { name: "Mansion Royal", type: 3, value: "6000" },
    { name: "Estate Imperial", type: 4, value: "10000" },
    { name: "Estate Sovereign", type: 4, value: "12000" },
  ];

  const typeNames = ["Studio", "Apartment", "Penthouse", "Mansion", "Estate"];
  for (let i = 0; i < initialSpaces.length; i++) {
    const s = initialSpaces[i];
    await spaceNFT.mintSpace(
      deployer.address,
      s.name,
      s.type,
      hre.ethers.parseEther(s.value),
      `ipfs://room68/space/${i}`
    );
    console.log(`  Minted: ${s.name} (${typeNames[s.type]}, value: ${s.value} R68)`);
  }

  const remaining = await spaceNFT.remainingSpaces();
  console.log(`\n  Total minted: ${initialSpaces.length} / 68`);
  console.log(`  Remaining for competitions: ${remaining}`);

  // Summary
  console.log("\n========================================");
  console.log("  ROOM 68 DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log(`  Room68Token:       ${r68Address}`);
  console.log(`  LivingSpaceNFT:    ${nftAddress}`);
  console.log(`  LivingSpaceMarket: ${marketAddress}`);
  console.log(`  LendingPool:       ${lendingAddress}`);
  console.log(`  CompetitionManager:${competitionAddress}`);
  console.log(`  SwapBridge:        ${swapAddress}`);
  console.log("========================================");
  console.log("  Max Supply: 68 living spaces");
  console.log("  Network: ARC Testnet (Chain ID: 5042002)");
  console.log("  Explorer: https://testnet.arcscan.app");
  console.log("========================================\n");

  const fs = require("fs");
  const deploymentData = {
    network: "ARC Testnet",
    chainId: 5042002,
    deployer: deployer.address,
    contracts: {
      Room68Token: r68Address,
      LivingSpaceNFT: nftAddress,
      LivingSpaceMarket: marketAddress,
      LendingPool: lendingAddress,
      CompetitionManager: competitionAddress,
      SwapBridge: swapAddress,
    },
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("Deployment addresses saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
