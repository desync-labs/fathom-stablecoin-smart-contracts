const { ethers } = require("hardhat");
const { expect } = require("chai");
const { smock } = require("@defi-wonderland/smock");

const { formatBytes32String } = ethers.utils;

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

describe("StablecoinAdapter", async () => {
  let stablecoinAdapter;
  let mockedBookKeeper;
  let mockedToken;
  let mockedCollateralPoolConfig;
  let mockedAccessControlConfig;
  let DeployerAddress;
  let AliceAddress;

  beforeEach(async () => {
    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");

    mockedBookKeeper = await smock.fake("BookKeeper");
    mockedToken = await smock.fake("ERC20Mintable");

    mockedToken.decimals.returns(18);
    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));
    mockedAccessControlConfig.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"));
    mockedAccessControlConfig.hasRole.returns(true);
    mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);

    const StablecoinAdapterFactory = await ethers.getContractFactory("MockStablecoinAdapter");
    stablecoinAdapter = await StablecoinAdapterFactory.deploy();
    await stablecoinAdapter.deployed();

    await stablecoinAdapter.initialize(mockedBookKeeper.address, mockedToken.address);

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
