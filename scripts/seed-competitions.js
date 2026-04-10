const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Seeding competitions with account:", deployer.address);

  // Load deployment addresses
  const deployment = JSON.parse(fs.readFileSync("deployment.json", "utf8"));
  const compAddress = deployment.contracts.CompetitionManager;
  console.log("CompetitionManager:", compAddress);

  const competition = await hre.ethers.getContractAt("CompetitionManager", compAddress);

  const usdc = (n) => hre.ethers.parseUnits(String(n), 6);

  // Competition types: 0=Chess, 1=Crossword, 2=Scrabble, 3=Dancing, 4=Music, 5=MarketInsight
  // SpaceType: 0=Studio, 1=Apartment, 2=Penthouse, 3=Mansion, 4=Estate
  const comps = [
    {
      type: 0, name: "Chess Grand Prix #1",
      desc: "Best-of-3 chess match. Submit your PGN notation or winning move.",
      entryFee: usdc(10), maxP: 8, spaceType: 0, spaceValue: usdc(150), hours: 72,
    },
    {
      type: 1, name: "Sunday Crossword Challenge",
      desc: "Solve the 15x15 crossword. Submit your completed grid answers.",
      entryFee: usdc(5), maxP: 20, spaceType: 0, spaceValue: usdc(100), hours: 48,
    },
    {
      type: 2, name: "Scrabble Showdown",
      desc: "Highest scoring word wins. Submit your best word + board position.",
      entryFee: usdc(8), maxP: 10, spaceType: 0, spaceValue: usdc(120), hours: 24,
    },
    {
      type: 3, name: "Dance Battle Royale",
      desc: "Record your best 60-second dance routine. Judge picks the winner.",
      entryFee: usdc(15), maxP: 6, spaceType: 1, spaceValue: usdc(500), hours: 96,
    },
    {
      type: 4, name: "Beat Making Contest",
      desc: "Produce an original 90-second track. Best beat wins the space.",
      entryFee: usdc(20), maxP: 8, spaceType: 1, spaceValue: usdc(600), hours: 72,
    },
    {
      type: 5, name: "Market Prediction: ARC Price",
      desc: "Predict ARC token price at end of week. Closest wins.",
      entryFee: usdc(10), maxP: 50, spaceType: 1, spaceValue: usdc(400), hours: 168,
    },
    {
      type: 0, name: "Blitz Chess Tournament",
      desc: "3-minute blitz format. Submit your best move sequence.",
      entryFee: usdc(5), maxP: 16, spaceType: 0, spaceValue: usdc(130), hours: 24,
    },
    {
      type: 5, name: "DeFi Yield Predictor",
      desc: "Predict which protocol offers best yield this week. Closest % wins.",
      entryFee: usdc(12), maxP: 30, spaceType: 2, spaceValue: usdc(2000), hours: 168,
    },
  ];

  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    console.log(`\nCreating: ${c.name}...`);
    const tx = await competition.createCompetitionMintReward(
      c.type, c.name, c.desc, c.entryFee, c.maxP,
      deployer.address, // judge = deployer for testing
      c.spaceType, c.spaceValue, c.hours
    );
    await tx.wait();
    console.log(`  ✓ Created competition #${i}`);
  }

  const total = await competition.nextCompetitionId();
  console.log(`\n========================================`);
  console.log(`  ${total} competitions seeded!`);
  console.log(`========================================`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
