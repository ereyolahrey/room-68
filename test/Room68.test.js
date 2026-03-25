const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Room 68 Contracts", function () {
  let r68Token, spaceNFT, market, lendingPool, competition, swapBridge;
  let owner, agent1, agent2, judge;

  beforeEach(async function () {
    [owner, agent1, agent2, judge] = await ethers.getSigners();

    // Deploy Room68Token
    const Room68Token = await ethers.getContractFactory("Room68Token");
    r68Token = await Room68Token.deploy();

    // Deploy LivingSpaceNFT
    const LivingSpaceNFT = await ethers.getContractFactory("LivingSpaceNFT");
    spaceNFT = await LivingSpaceNFT.deploy();

    // Deploy LivingSpaceMarket
    const LivingSpaceMarket = await ethers.getContractFactory("LivingSpaceMarket");
    market = await LivingSpaceMarket.deploy(await r68Token.getAddress(), await spaceNFT.getAddress());

    // Deploy LendingPool
    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(await r68Token.getAddress());

    // Deploy CompetitionManager
    const CompetitionManager = await ethers.getContractFactory("CompetitionManager");
    competition = await CompetitionManager.deploy(await r68Token.getAddress(), await spaceNFT.getAddress());

    // Deploy SwapBridge
    const SwapBridge = await ethers.getContractFactory("SwapBridge");
    swapBridge = await SwapBridge.deploy(await r68Token.getAddress());

    // Authorize market and competition on NFT
    await spaceNFT.authorizeMarket(await market.getAddress());
    await spaceNFT.authorizeMarket(await competition.getAddress());

    // Distribute tokens to agents
    await r68Token.transfer(agent1.address, ethers.parseEther("10000"));
    await r68Token.transfer(agent2.address, ethers.parseEther("10000"));
  });

  describe("Room68Token", function () {
    it("should have correct name and symbol", async function () {
      expect(await r68Token.name()).to.equal("Room 68 Token");
      expect(await r68Token.symbol()).to.equal("R68");
    });

    it("should have initial supply minted to deployer", async function () {
      const totalSupply = await r68Token.totalSupply();
      expect(totalSupply).to.equal(ethers.parseEther("10000000"));
    });
  });

  describe("LivingSpaceNFT", function () {
    it("should mint a space", async function () {
      await spaceNFT.mintSpace(agent1.address, "Studio Alpha", 0, ethers.parseEther("100"), "ipfs://test");
      expect(await spaceNFT.ownerOf(0)).to.equal(agent1.address);
      const space = await spaceNFT.getSpace(0);
      expect(space.name).to.equal("Studio Alpha");
    });

    it("should enumerate spaces by owner", async function () {
      await spaceNFT.mintSpace(agent1.address, "Space 1", 0, ethers.parseEther("100"), "ipfs://1");
      await spaceNFT.mintSpace(agent1.address, "Space 2", 1, ethers.parseEther("500"), "ipfs://2");
      const spaces = await spaceNFT.getSpacesByOwner(agent1.address);
      expect(spaces.length).to.equal(2);
    });
  });

  describe("LivingSpaceMarket", function () {
    beforeEach(async function () {
      // Mint a space to agent1
      await spaceNFT.mintSpace(agent1.address, "Test Space", 1, ethers.parseEther("500"), "ipfs://test");
    });

    it("should list and buy a space", async function () {
      const marketAddr = await market.getAddress();

      // Agent1 lists space
      await spaceNFT.connect(agent1).approve(marketAddr, 0);
      await market.connect(agent1).listSpace(0, ethers.parseEther("500"));

      // Agent2 buys space
      await r68Token.connect(agent2).approve(marketAddr, ethers.parseEther("500"));
      await market.connect(agent2).buySpace(0);

      expect(await spaceNFT.ownerOf(0)).to.equal(agent2.address);
    });

    it("should start a down payment plan", async function () {
      const marketAddr = await market.getAddress();

      // Agent1 lists space
      await spaceNFT.connect(agent1).approve(marketAddr, 0);
      await market.connect(agent1).listSpace(0, ethers.parseEther("500"));

      // Agent2 starts down payment with 20% (100 R68) — needs 50% reserves (250 R68)
      await r68Token.connect(agent2).approve(marketAddr, ethers.parseEther("100"));
      await market.connect(agent2).startDownPayment(0, ethers.parseEther("100"), 30);

      const dp = await market.downPayments(0);
      expect(dp.buyer).to.equal(agent2.address);
      expect(dp.amountPaid).to.equal(ethers.parseEther("100"));
    });
  });

  describe("LendingPool", function () {
    it("should allow creating offers and borrowing", async function () {
      const poolAddr = await lendingPool.getAddress();

      // Agent1 deposits collateral
      await r68Token.connect(agent1).approve(poolAddr, ethers.parseEther("3000"));
      await lendingPool.connect(agent1).depositCollateral(ethers.parseEther("1500"));

      // Agent2 creates lending offer
      await r68Token.connect(agent2).approve(poolAddr, ethers.parseEther("1000"));
      await lendingPool.connect(agent2).createOffer(ethers.parseEther("1000"), 1000, 7, 30);

      // Agent1 borrows
      await lendingPool.connect(agent1).borrow(0, ethers.parseEther("1000"), 14);

      const loan = await lendingPool.loans(0);
      expect(loan.borrower).to.equal(agent1.address);
      expect(loan.principal).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("CompetitionManager", function () {
    it("should create and join a competition", async function () {
      const compAddr = await competition.getAddress();

      // Create a chess competition
      await competition.createCompetition(
        0, // Chess
        "Chess Tournament #1",
        "First Room 68 chess tournament",
        ethers.parseEther("10"),
        4,
        judge.address,
        0, // no space reward
        24
      );

      // Agents join
      await r68Token.connect(agent1).approve(compAddr, ethers.parseEther("10"));
      await competition.connect(agent1).joinCompetition(0);

      await r68Token.connect(agent2).approve(compAddr, ethers.parseEther("10"));
      await competition.connect(agent2).joinCompetition(0);

      const comp = await competition.getCompetition(0);
      expect(comp.participantCount).to.equal(2);
      expect(comp.prizePool).to.equal(ethers.parseEther("20"));
    });

    it("should declare winner and distribute prize", async function () {
      const compAddr = await competition.getAddress();

      await competition.createCompetition(0, "Chess Match", "Quick match", ethers.parseEther("10"), 2, judge.address, 0, 1);

      await r68Token.connect(agent1).approve(compAddr, ethers.parseEther("10"));
      await competition.connect(agent1).joinCompetition(0);

      await r68Token.connect(agent2).approve(compAddr, ethers.parseEther("10"));
      await competition.connect(agent2).joinCompetition(0);

      // Start competition (auto-starts at max participants)
      await competition.startCompetition(0);

      // Judge declares winner
      const balanceBefore = await r68Token.balanceOf(agent1.address);
      await competition.connect(judge).declareWinner(0, agent1.address);
      const balanceAfter = await r68Token.balanceOf(agent1.address);

      // Winner gets prize pool minus 5% fee = 19 R68
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("19"));
    });
  });
});
