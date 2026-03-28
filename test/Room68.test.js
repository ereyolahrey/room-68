const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Room 68 Contracts", function () {
  let r68Token, spaceNFT, market, lendingPool, competition, swapBridge;
  let owner, agent1, agent2, judge;

  beforeEach(async function () {
    [owner, agent1, agent2, judge] = await ethers.getSigners();

    const Room68Token = await ethers.getContractFactory("Room68Token");
    r68Token = await Room68Token.deploy();

    const LivingSpaceNFT = await ethers.getContractFactory("LivingSpaceNFT");
    spaceNFT = await LivingSpaceNFT.deploy(await r68Token.getAddress());

    const LivingSpaceMarket = await ethers.getContractFactory("LivingSpaceMarket");
    market = await LivingSpaceMarket.deploy(await r68Token.getAddress(), await spaceNFT.getAddress());

    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(await r68Token.getAddress(), await spaceNFT.getAddress());

    const CompetitionManager = await ethers.getContractFactory("CompetitionManager");
    competition = await CompetitionManager.deploy(await r68Token.getAddress(), await spaceNFT.getAddress());

    const SwapBridge = await ethers.getContractFactory("SwapBridge");
    swapBridge = await SwapBridge.deploy(await r68Token.getAddress());

    // Authorize contracts
    await spaceNFT.authorizeMarket(await market.getAddress());
    await spaceNFT.authorizeMarket(await competition.getAddress());
    await spaceNFT.authorizeMarket(await lendingPool.getAddress());

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
    it("should have max supply of 68", async function () {
      expect(await spaceNFT.MAX_SUPPLY()).to.equal(68);
    });

    it("should mint a space and track remaining", async function () {
      await spaceNFT.mintSpace(agent1.address, "Studio Alpha", 0, ethers.parseEther("100"), "ipfs://test");
      expect(await spaceNFT.ownerOf(0)).to.equal(agent1.address);
      expect(await spaceNFT.remainingSpaces()).to.equal(67);
    });

    it("should enumerate spaces by owner (stacking)", async function () {
      await spaceNFT.mintSpace(agent1.address, "Space 1", 0, ethers.parseEther("100"), "ipfs://1");
      await spaceNFT.mintSpace(agent1.address, "Space 2", 1, ethers.parseEther("500"), "ipfs://2");
      await spaceNFT.mintSpace(agent1.address, "Space 3", 2, ethers.parseEther("2000"), "ipfs://3");
      const spaces = await spaceNFT.getSpacesByOwner(agent1.address);
      expect(spaces.length).to.equal(3);
    });
  });

  describe("Rentals", function () {
    beforeEach(async function () {
      await spaceNFT.mintSpace(agent1.address, "Rental Unit", 1, ethers.parseEther("500"), "ipfs://rental");
    });

    it("should list, rent, pay rent, and end rental", async function () {
      const nftAddr = await spaceNFT.getAddress();
      const monthlyRent = ethers.parseEther("50");
      const deposit = ethers.parseEther("100");

      // Agent1 lists space for rent
      await spaceNFT.connect(agent1).listForRent(0, monthlyRent, deposit, 1, 6);

      // Agent2 rents it (pays deposit + first month)
      await r68Token.connect(agent2).approve(nftAddr, ethers.parseEther("150"));
      await spaceNFT.connect(agent2).rentSpace(0, 3);

      const rental = await spaceNFT.rentals(0);
      expect(rental.tenant).to.equal(agent2.address);
      expect(rental.active).to.equal(true);

      // Agent2 pays rent
      await r68Token.connect(agent2).approve(nftAddr, monthlyRent);
      await spaceNFT.connect(agent2).payRent(0);

      // Fast forward past end time and end rental
      await ethers.provider.send("evm_increaseTime", [91 * 86400]);
      await ethers.provider.send("evm_mine");

      await spaceNFT.connect(agent2).endRental(0);
      const rentalAfter = await spaceNFT.rentals(0);
      expect(rentalAfter.active).to.equal(false);
    });
  });

  describe("LivingSpaceMarket", function () {
    beforeEach(async function () {
      await spaceNFT.mintSpace(agent1.address, "Test Space", 1, ethers.parseEther("500"), "ipfs://test");
    });

    it("should list and buy a space", async function () {
      const marketAddr = await market.getAddress();

      await spaceNFT.connect(agent1).approve(marketAddr, 0);
      await market.connect(agent1).listSpace(0, ethers.parseEther("500"));

      await r68Token.connect(agent2).approve(marketAddr, ethers.parseEther("500"));
      await market.connect(agent2).buySpace(0);

      expect(await spaceNFT.ownerOf(0)).to.equal(agent2.address);
    });

    it("should start a down payment plan", async function () {
      const marketAddr = await market.getAddress();

      await spaceNFT.connect(agent1).approve(marketAddr, 0);
      await market.connect(agent1).listSpace(0, ethers.parseEther("500"));

      await r68Token.connect(agent2).approve(marketAddr, ethers.parseEther("100"));
      await market.connect(agent2).startDownPayment(0, ethers.parseEther("100"), 30);

      const dp = await market.downPayments(0);
      expect(dp.buyer).to.equal(agent2.address);
      expect(dp.amountPaid).to.equal(ethers.parseEther("100"));
    });
  });

  describe("LendingPool", function () {
    it("should allow creating offers and borrowing with R68 collateral", async function () {
      const poolAddr = await lendingPool.getAddress();

      await r68Token.connect(agent1).approve(poolAddr, ethers.parseEther("3000"));
      await lendingPool.connect(agent1).depositCollateral(ethers.parseEther("1500"));

      await r68Token.connect(agent2).approve(poolAddr, ethers.parseEther("1000"));
      await lendingPool.connect(agent2).createOffer(ethers.parseEther("1000"), 1000, 7, 30);

      await lendingPool.connect(agent1).borrow(0, ethers.parseEther("1000"), 14);

      const loan = await lendingPool.loans(0);
      expect(loan.borrower).to.equal(agent1.address);
      expect(loan.principal).to.equal(ethers.parseEther("1000"));
    });

    it("should allow borrowing with NFT collateral", async function () {
      const poolAddr = await lendingPool.getAddress();

      // Mint a space to agent1 (value 500 R68 -> 50% LTV = can borrow 250)
      await spaceNFT.mintSpace(agent1.address, "Collateral Space", 1, ethers.parseEther("500"), "ipfs://coll");

      // Agent2 creates a lending offer
      await r68Token.connect(agent2).approve(poolAddr, ethers.parseEther("500"));
      await lendingPool.connect(agent2).createOffer(ethers.parseEther("500"), 1000, 7, 30);

      // Agent1 borrows against their NFT
      await spaceNFT.connect(agent1).approve(poolAddr, 0);
      await lendingPool.connect(agent1).borrowWithNFT(0, 0, 14);

      const loan = await lendingPool.loans(0);
      expect(loan.borrower).to.equal(agent1.address);
      expect(loan.principal).to.equal(ethers.parseEther("250")); // 50% of 500
      expect(loan.nftCollateral).to.equal(0);
    });
  });

  describe("CompetitionManager", function () {
    it("should create competition with mint reward and agents join", async function () {
      const compAddr = await competition.getAddress();

      // Create a chess competition that mints a Studio for the winner
      await competition.createCompetitionMintReward(
        0, // Chess
        "Chess Tournament #1",
        "First Room 68 chess tournament",
        ethers.parseEther("10"),
        4,
        judge.address,
        0, // Studio type
        ethers.parseEther("200"), // space value
        24
      );

      await r68Token.connect(agent1).approve(compAddr, ethers.parseEther("10"));
      await competition.connect(agent1).joinCompetition(0);

      await r68Token.connect(agent2).approve(compAddr, ethers.parseEther("10"));
      await competition.connect(agent2).joinCompetition(0);

      const comp = await competition.getCompetition(0);
      expect(comp.participantCount).to.equal(2);
      expect(comp.prizePool).to.equal(ethers.parseEther("20"));
    });

    it("should declare winner — gets BOTH space AND liquidity", async function () {
      const compAddr = await competition.getAddress();

      await competition.createCompetitionMintReward(
        0, "Chess Match", "Quick match",
        ethers.parseEther("10"), 2, judge.address,
        1, ethers.parseEther("500"), 1 // Apartment, 500 R68 value
      );

      await r68Token.connect(agent1).approve(compAddr, ethers.parseEther("10"));
      await competition.connect(agent1).joinCompetition(0);

      await r68Token.connect(agent2).approve(compAddr, ethers.parseEther("10"));
      await competition.connect(agent2).joinCompetition(0);

      await competition.startCompetition(0);

      const balanceBefore = await r68Token.balanceOf(agent1.address);
      const nftsBefore = await spaceNFT.balanceOf(agent1.address);

      await competition.connect(judge).declareWinner(0, agent1.address);

      const balanceAfter = await r68Token.balanceOf(agent1.address);
      const nftsAfter = await spaceNFT.balanceOf(agent1.address);

      // Winner gets prize pool minus 5% fee = 19 R68
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("19"));

      // Winner also gets a new living space NFT
      expect(nftsAfter - nftsBefore).to.equal(1);
    });
  });
});
