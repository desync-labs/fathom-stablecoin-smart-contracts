const { ethers } = require("hardhat");
const provider = ethers.provider;
const { expect } = require("chai");

const { DeployerAddress, AliceAddress, BobAddress } = require("../helper/address");
const { getProxy } = require("../../common/proxies");

describe("CollateralTokenAdapter", () => {
  // Contracts
  let collateralTokenAdapter;
  let WNATIVE;
  let bookKeeper;

  beforeEach(async () => {
    await deployments.fixture(["DeployTestFixture"]);

    const ProxyFactory = await deployments.get("FathomProxyFactory");
    const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
    collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
    bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const _WNATIVE = await deployments.get("WNATIVE");
    WNATIVE = await ethers.getContractAt("WNATIVE", _WNATIVE.address);
  });
  describe("#totalShare", async () => {
    context("when all collateral tokens are deposited by deposit function", async () => {
      it("should return the correct net asset valuation", async () => {
        //Alice wraps NATIVE to WNATIVE
        await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });
        //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
        await collateralTokenAdapter.addToWhitelist(AliceAddress);
        await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"));

        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .withdraw(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0);
      });
    });

    context("when some one directly transfer collateral tokens to CollateralTokenAdapter", async () => {
      it("should only recognized collateral tokens from deposit function", async () => {
        //Alice wraps NATIVE to WNATIVE
        await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });
        //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
        await collateralTokenAdapter.addToWhitelist(AliceAddress);
        await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));
        //Bob wraps NATIVE to WNATIVE
        await WNATIVE.connect(provider.getSigner(BobAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(89) });
        await WNATIVE.connect(provider.getSigner(BobAddress)).transfer(collateralTokenAdapter.address, ethers.utils.parseEther("88"));

        expect(await WNATIVE.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"));
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"));

        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .withdraw(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));

        expect(await WNATIVE.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"));
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0);
      });
    });
  });

  describe("#deposit", async () => {
    context("when CollateralTokenAdapter is not live", async () => {
      it("should revert", async () => {
        // Cage collateralTokenAdapter
        await collateralTokenAdapter.cage();
        await collateralTokenAdapter.addToWhitelist(DeployerAddress);
        await expect(
          collateralTokenAdapter.deposit(
            DeployerAddress,
            ethers.utils.parseEther("1"),
            ethers.utils.defaultAbiCoder.encode(["address"], [DeployerAddress])
          )
        ).to.be.revertedWith("CollateralTokenAdapter/not-live");
      });
    });

    context("when all parameters are valid", async () => {
      it("should work", async () => {
        //Alice wraps NATIVE to WNATIVE
        await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("2"));
        //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
        await collateralTokenAdapter.addToWhitelist(AliceAddress);
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"));
        let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));

        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .deposit(AliceAddress, 0, ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"));

        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));

        //Bob wraps NATIVE to WNATIVE
        await WNATIVE.connect(provider.getSigner(BobAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(4) });
        await WNATIVE.connect(provider.getSigner(BobAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"));
        //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
        await collateralTokenAdapter.addToWhitelist(BobAddress);
        await collateralTokenAdapter
          .connect(provider.getSigner(BobAddress))
          .deposit(BobAddress, ethers.utils.parseEther("4"), ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"));
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));

        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"));

        await collateralTokenAdapter
          .connect(provider.getSigner(BobAddress))
          .deposit(BobAddress, 0, ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"));
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"));
      });
    });
  });

  describe("#withdraw", async () => {
    context("when withdraw more than what CollateralTokenAdapter staked", async () => {
      it("should revert", async () => {
        await collateralTokenAdapter.addToWhitelist(AliceAddress);
        //Alice wraps NATIVE to WNATIVE
        await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });
        await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));

        await expect(
          collateralTokenAdapter
            .connect(provider.getSigner(AliceAddress))
            .withdraw(AliceAddress, ethers.utils.parseEther("100"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]))
        ).to.be.revertedWith("CollateralTokenAdapter/insufficient collateral amount");
      });
    });

    context("when withdraw more than what he staked", async () => {
      it("should revert", async () => {
        await collateralTokenAdapter.addToWhitelist(AliceAddress);
        await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });
        await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));
        await collateralTokenAdapter.addToWhitelist(BobAddress);
        await WNATIVE.connect(provider.getSigner(BobAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(4) });
        await WNATIVE.connect(provider.getSigner(BobAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"));
        await collateralTokenAdapter
          .connect(provider.getSigner(BobAddress))
          .deposit(BobAddress, ethers.utils.parseEther("4"), ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]));

        await expect(
          collateralTokenAdapter
            .connect(provider.getSigner(AliceAddress))
            .withdraw(AliceAddress, ethers.utils.parseEther("2"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]))
        ).to.be.revertedWith("CollateralTokenAdapter/insufficient collateral amount");
      });
    });

    context("when CollateralTokenAdapter is not live", async () => {
      it("should still allow user to withdraw", async () => {
        await collateralTokenAdapter.addToWhitelist(AliceAddress);
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });
        await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"));
        let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));

        // Cage CollateralTokenAdapter
        await collateralTokenAdapter.cage();
        expect(await collateralTokenAdapter.live()).to.be.eq(0);

        // Now Alice withdraw her position. 4 blocks have been passed.
        // CollateralTokenAdapter is caged, non of FXD has been harvested.
        // Staked collateralTokens have been emergencyWithdraw from FairLaunch.
        // The following conditions must be satisfy:
        // - Alice should get 0 FXD as cage before FXD get harvested.
        // - Alice should get 1 WNATIVE back.
        let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress);
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .withdraw(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));
        let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress);

        expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("1"));
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0);
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"));
      });

      it("should still allow user to withdraw with pending rewards (if any)", async () => {
        await collateralTokenAdapter.addToWhitelist(AliceAddress);
        await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });

        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"));
        let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));

        await WNATIVE.connect(provider.getSigner(BobAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(4) });
        await collateralTokenAdapter.addToWhitelist(BobAddress);

        // Bob join the party with 4 WNATIVE! 2 Blocks have been passed.
        await WNATIVE.connect(provider.getSigner(BobAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"));
        await collateralTokenAdapter
          .connect(provider.getSigner(BobAddress))
          .deposit(BobAddress, ethers.utils.parseEther("4"), ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"));
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"));

        // advanceBlock
        await hre.network.provider.send("hardhat_mine", ["0x01"]);

        // Cage CollateralTokenAdapter
        await collateralTokenAdapter.cage();
        expect(await collateralTokenAdapter.live()).to.be.eq(0);

        // Now Alice withdraw her position. Only 200 FXD has been harvested from FairLaunch.
        // CollateralTokenAdapter is caged. Staked collateralTokens have been emergencyWithdraw from FairLaunch.
        // The following conditions must be satisfy:
        // - Alice pending rewards must be 200 FXD
        // - Bob pending rewards must be 0 FXD as all rewards after Bob deposited hasn't been harvested.
        // - Alice should get 180 (200 - 10%) FXD that is harvested before cage (when Bob deposited)
        // - Alice should get 1 WNATIVE back.
        // - treasury account should get 20 FXD.

        let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress);
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .withdraw(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));
        let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress);

        expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("1"));
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"));
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"));

        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"));

        let bobWNATIVEbefore = await WNATIVE.balanceOf(BobAddress);
        await collateralTokenAdapter
          .connect(provider.getSigner(BobAddress))
          .withdraw(BobAddress, ethers.utils.parseEther("4"), ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]));
        let bobWNATIVEafter = await WNATIVE.balanceOf(BobAddress);

        expect(bobWNATIVEafter.sub(bobWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("4"));
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0);
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"));

        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("0"));
      });
    });

    context("when all parameters are valid", async () => {
      it("should work", async () => {
        await collateralTokenAdapter.addToWhitelist(AliceAddress);
        //Alice wraps NATIVE to WNATIVE
        await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"));
        let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));

        // Now Alice withdraw her position. 1 block has been passed, hence Alice should get 90 (100 - 10%) FXD, treasury account should get 10 FXD.
        let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress);
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .withdraw(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));
        let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress);

        expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("1"));
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0);
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"));
      });
    });
    context("when bob withdraw collateral to alice", async () => {
      context("when bob doesn't has collateral", () => {
        it("should be revert", async () => {
          await collateralTokenAdapter.addToWhitelist(AliceAddress);
          await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });
          // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
          await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
          await collateralTokenAdapter
            .connect(provider.getSigner(AliceAddress))
            .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));
          await collateralTokenAdapter.addToWhitelist(BobAddress);
          //checking with Subik-ji
          let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();

          expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));

          await expect(
            collateralTokenAdapter
              .connect(provider.getSigner(BobAddress))
              .withdraw(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]))
          ).to.be.revertedWith("CollateralTokenAdapter/insufficient collateral amount");
        });
      });
      context("when bob has collateral", async () => {
        it("should be able to call withdraw", async () => {
          await collateralTokenAdapter.addToWhitelist(AliceAddress);
          await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });
          await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
          await collateralTokenAdapter
            .connect(provider.getSigner(AliceAddress))
            .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));

          expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"));
          let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
          expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));

          await collateralTokenAdapter.addToWhitelist(BobAddress);
          await WNATIVE.connect(provider.getSigner(BobAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });
          await WNATIVE.connect(provider.getSigner(BobAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
          await collateralTokenAdapter
            .connect(provider.getSigner(BobAddress))
            .deposit(BobAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]));

          let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress);
          let bobWNATIVEbefore = await WNATIVE.balanceOf(BobAddress);
          await collateralTokenAdapter
            .connect(provider.getSigner(BobAddress))
            .withdraw(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]));
          let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress);
          let bobWNATIVEafter = await WNATIVE.balanceOf(BobAddress);

          expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("1"));
          expect(bobWNATIVEafter.sub(bobWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("0"));
        });
      });
    });
  });

  describe("#emergencyWithdraw", async () => {
    context("when CollateralTokenAdapter is not live", async () => {
      it("should allow users to exit with emergencyWithdraw and normal withdraw", async () => {
        await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(2) });
        await collateralTokenAdapter.addToWhitelist(AliceAddress);
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"));
        let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));

        await WNATIVE.connect(provider.getSigner(BobAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(4) });
        await collateralTokenAdapter.addToWhitelist(BobAddress);
        // Bob join the party with 4 WNATIVE! 2 Blocks have been passed.
        await WNATIVE.connect(provider.getSigner(BobAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"));
        await collateralTokenAdapter
          .connect(provider.getSigner(BobAddress))
          .deposit(BobAddress, ethers.utils.parseEther("4"), ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"));
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));

        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"));

        // Move 1 block so CollateralTokenAdapter make 100 FXD. However this portion
        // won't be added as CollateralTokenAdapter cage before it get harvested.
        await hre.network.provider.send("hardhat_mine", ["0x01"]);

        // Cage CollateralTokenAdapter
        await collateralTokenAdapter.cage();
        expect(await collateralTokenAdapter.live()).to.be.eq(0);

        // Alice panic and decided to emergencyWithdraw.
        // The following states are expected:
        // - Alice should get 1 WNATIVE back.
        let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress);
        await collateralTokenAdapter.connect(provider.getSigner(AliceAddress)).emergencyWithdraw(AliceAddress);
        let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress);

        expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("1"));
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"));
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"));
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"));

        // Bob chose to withdraw normal.
        // But in real life situation, Bob would not be whitelisted so that he can
        // directly deposit and withdraw WNATIVE via CollateralTokenAdapter.
        // The following states are expected:
        // - Bob should get his 4 WNATIVE back
        let bobWNATIVEbefore = await WNATIVE.balanceOf(BobAddress);
        await collateralTokenAdapter
          .connect(provider.getSigner(BobAddress))
          .withdraw(BobAddress, ethers.utils.parseEther("4"), ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]));
        let bobWNATIVEafter = await WNATIVE.balanceOf(BobAddress);

        expect(bobWNATIVEafter.sub(bobWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("4"));
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0);
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"));
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("0"));
      });
    });

    context("when all states are normal", async () => {
      it("can call emergencyWithdraw but the state will stay the same", async () => {
        await WNATIVE.connect(provider.getSigner(AliceAddress)).deposit({ value: ethers.constants.WeiPerEther.mul(1) });
        await collateralTokenAdapter.addToWhitelist(AliceAddress);
        await WNATIVE.connect(provider.getSigner(AliceAddress)).approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"));
        await collateralTokenAdapter
          .connect(provider.getSigner(AliceAddress))
          .deposit(AliceAddress, ethers.utils.parseEther("1"), ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]));

        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"));
        let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));

        // Alice feels in-secure, so she does emergencyWithdraw
        // However, the collateralTokenAdapter is not uncaged, therefore
        // - Alice cannot get here 1 WNATIVE back
        // - Alice's state stays the same.
        let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress);
        await collateralTokenAdapter.connect(provider.getSigner(AliceAddress)).emergencyWithdraw(AliceAddress);
        let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress);

        expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("0"));
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"));
        expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"));
      });
    });
  });

  describe("#cage/#uncage", async () => {
    context("when whitelist cage", async () => {
      it("should put CollateralTokenAdapter live = 0", async () => {
        await collateralTokenAdapter.cage();
        expect(await collateralTokenAdapter.live()).to.be.eq(0);
      });
    });

    context("when caller not owner role cage", async () => {
      context("when assumptions still valid", async () => {
        it("should revert", async () => {
          await expect(collateralTokenAdapter.connect(provider.getSigner(AliceAddress)).cage()).to.be.revertedWith(
            "CollateralTokenAdapter/not-authorized"
          );
        });
      });
    });
  });
});
