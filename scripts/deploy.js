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

  // 2. Deploy LivingSpaceNFT
  console.log("\n--- Deploying LivingSpaceNFT ---");
  const LivingSpaceNFT = await hre.ethers.getContractFactory("LivingSpaceNFT");
  const spaceNFT = await LivingSpaceNFT.deploy();
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

  // 4. Deploy LendingPool
  console.log("\n--- Deploying LendingPool ---");
  const LendingPool = await hre.ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(r68Address);
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

  // Authorize market and competition contracts to manage NFTs
  await spaceNFT.authorizeMarket(marketAddress);
  console.log("Market authorized on LivingSpaceNFT");

  await spaceNFT.authorizeMarket(competitionAddress);
  console.log("CompetitionManager authorized on LivingSpaceNFT");

  // Add CompetitionManager as minter for R68 token (for rewards)
  await r68Token.addMinter(competitionAddress);
  console.log("CompetitionManager added as R68 minter");

  // Mint some initial living spaces
  console.log("\n--- Minting initial living spaces ---");
  const spaceTypes = [0, 0, 1, 1, 2, 3, 4]; // Studio, Studio, Apt, Apt, Penthouse, Mansion, Estate
  const spaceNames = ["Studio Alpha", "Studio Beta", "Apartment Luxe", "Apartment Prime", "Penthouse Sky", "Mansion Grand", "Estate Royal"];
  const spaceValues = [
    hre.ethers.parseEther("100"),
    hre.ethers.parseEther("120"),
    hre.ethers.parseEther("500"),
    hre.ethers.parseEther("600"),
    hre.ethers.parseEther("2000"),
    hre.ethers.parseEther("5000"),
    hre.ethers.parseEther("10000"),
  ];

  for (let i = 0; i < spaceTypes.length; i++) {
    await spaceNFT.mintSpace(
      deployer.address,
      spaceNames[i],
      spaceTypes[i],
      spaceValues[i],
      `ipfs://room68/space/${i}`
    );
    console.log(`  Minted: ${spaceNames[i]} (value: ${hre.ethers.formatEther(spaceValues[i])} R68)`);
  }

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
  console.log("  Network: ARC Testnet (Chain ID: 5042002)");
  console.log("  Explorer: https://testnet.arcscan.app");
  console.log("========================================\n");

  // Write deployment addresses to file for frontend
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
