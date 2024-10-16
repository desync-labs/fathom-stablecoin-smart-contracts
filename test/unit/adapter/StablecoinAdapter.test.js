const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { deployFixtures } = require("./StablecoinAdapter.fixtures");

const { formatBytes32String } = ethers.utils;

const COLLATERAL_POOL_ID = formatBytes32String("NATIVE");

describe("StablecoinAdapter", async () => {
  let stablecoinAdapter;
  let mockedBookKeeper;
  let mockedToken;
  let mockedCollateralPoolConfig;
  let DeployerAddress;
  let AliceAddress;

  beforeEach(async () => {
    ({ stablecoinAdapter, mockedBookKeeper, mockedToken, mockedCollateralPoolConfig } = await loadFixture(deployFixtures));
    const { deployer, allice } = await getNamedAccounts();
    DeployerAddress = deployer;
    AliceAddress = allice;
  });

  context("depositRAD function", async () => {
    it("should allow deposit from a designated liquidation strategy", async () => {
      // Set mock to return true for strategy verification
      mockedCollateralPoolConfig.getStrategy.returns(DeployerAddress);

      mockedBookKeeper.moveStablecoin.returns();
      mockedToken.burn.returns();
      // Call depositRAD function from the designated liquidation strategy
      await expect(stablecoinAdapter.depositRAD(DeployerAddress, ethers.constants.MaxUint256, COLLATERAL_POOL_ID, "0x")).to.not.be.reverted;
    });

    it("should not allow deposit from a non-designated liquidation strategy", async () => {
      // Set mock to return another address for strategy verification
      mockedCollateralPoolConfig.getStrategy.returns(AliceAddress);

      // Call depositRAD function from the designated liquidation strategy
      await expect(stablecoinAdapter.depositRAD(DeployerAddress, ethers.constants.MaxUint256, COLLATERAL_POOL_ID, "0x")).to.be.revertedWith(
        "!(LiquidationStrategy)"
      );
    });
  });
});
