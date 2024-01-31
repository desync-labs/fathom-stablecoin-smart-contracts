const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { formatBytes32String } = ethers.utils

const { DeployerAddress, AliceAddress, BobAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerWad } = require("../../helper/unit");
const { loadFixture } = require("../../helper/fixtures");

const COLLATERAL_POOL_ID = formatBytes32String("XDC")

const loadFixtureHandler = async () => {
  const mockedAccessControlConfig = await createMock("AccessControlConfig");
  const mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");

  const mockedBookKeeper = await createMock("BookKeeper");
  const mockedToken = await createMock("ERC20Mintable");

  await mockedToken.mock.decimals.returns(18)
  await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
  await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))
  await mockedAccessControlConfig.mock.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"))
  await mockedAccessControlConfig.mock.hasRole.returns(true)
  await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);


  const stablecoinAdapter = getContract("MockStablecoinAdapter", DeployerAddress)

  await stablecoinAdapter.initialize(
    mockedBookKeeper.address,
    mockedToken.address
  )

  return {
    stablecoinAdapter,
    mockedBookKeeper,
    mockedToken,
    mockedAccessControlConfig,
    mockedCollateralPoolConfig,
  }
}


describe("StablecoinAdapter", async () => {
  // Assuming you have necessary contract instances and other setups here
  let mockedCollateralPoolConfig;
  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => {
    ; ({ mockedCollateralPoolConfig, stablecoinAdapter, mockedBookKeeper, mockedToken } =
      await loadFixture(loadFixtureHandler))
  })

  context("depositRAD function", async () => {
    it("should allow deposit from a designated liquidation strategy", async () => {
      // Set mock to return true for strategy verification
      await mockedCollateralPoolConfig.mock.getStrategy.returns(DeployerAddress);

      await mockedBookKeeper.mock.moveStablecoin.returns()
      await mockedToken.mock.burn.returns()
      // Call depositRAD function from the designated liquidation strategy
      await expect(
        stablecoinAdapter.depositRAD(DeployerAddress, ethers.constants.MaxUint256, COLLATERAL_POOL_ID, "0x")
      ).to.not.be.reverted;
    });

    it("should not allow deposit from a non-designated liquidation strategy", async () => {
      // Set mock to return another address for strategy verification
      await mockedCollateralPoolConfig.mock.getStrategy.returns(AliceAddress);

      // Call depositRAD function from the designated liquidation strategy
      await expect(
        stablecoinAdapter.depositRAD(DeployerAddress, ethers.constants.MaxUint256, COLLATERAL_POOL_ID, "0x")
      ).to.be.revertedWith("!(LiquidationStrategy)");
    });
  });
});

