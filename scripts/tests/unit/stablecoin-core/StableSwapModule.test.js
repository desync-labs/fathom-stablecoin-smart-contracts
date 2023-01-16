const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { formatBytes32String } = ethers.utils

const { DeployerAddress, AliceAddress } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerRay, WeiPerWad } = require("../../helper/unit")
const { loadFixture } = require("../../helper/fixtures");
const ERC20Stable = artifacts.require('ERC20MintableStableSwap.sol')
const ERC20USDT = artifacts.require('ERC20Mintable.sol');
const loadFixtureHandler = async () => {
    mockedAccessControlConfig = await createMock("AccessControlConfig");
    mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
    mockSystemDebtEngine = await createMock("SystemDebtEngine");
    mockAuthTokenAdapter = await createMock("AuthTokenAdapter");
    mockStablecoinAdapter = await createMock("StablecoinAdapter");
    mockFathomStablecoin = await createMock("FathomStablecoin");
    mockBookKeeper = await createMock("BookKeeper");

    await mockAuthTokenAdapter.mock.bookKeeper.returns(mockBookKeeper.address)
    await mockBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
    await mockBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
    await mockStablecoinAdapter.mock.stablecoin.returns(mockFathomStablecoin.address)
    await mockAuthTokenAdapter.mock.collateralPoolId.returns(formatBytes32String("WXDC"))
    await mockAuthTokenAdapter.mock.decimals.returns(BigNumber.from(18))

    await mockFathomStablecoin.mock.approve.returns(true)
    await mockBookKeeper.mock.whitelist.returns()

    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))

    stableSwapModule = getContract("StableSwapModule", DeployerAddress)
    stableSwapModuleAsAlice = getContract("StableSwapModule", AliceAddress)
    await stableSwapModule.initialize(
      mockBookKeeper.address,
      ERC20USDT.address,
      ERC20Stable.address,
      ethers.utils.parseUnits("10000", "ether")
    )


    return {
        stableSwapModule,
        stableSwapModuleAsAlice,
        mockAuthTokenAdapter,
        mockBookKeeper,
        mockStablecoinAdapter,
        mockFathomStablecoin,
        mockSystemDebtEngine,
        mockedAccessControlConfig
    }
}
describe("StableSwapModule", () => {
  // Contracts
  let mockAuthTokenAdapter
  let mockBookKeeper
  let mockStablecoinAdapter
  let mockFathomStablecoin
  let mockSystemDebtEngine
  let mockedAccessControlConfig

  let stableSwapModule
  let stableSwapModuleAsAlice

  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => {
    ;({
        stableSwapModule,
        stableSwapModuleAsAlice,
        mockAuthTokenAdapter,
        mockBookKeeper,
        mockStablecoinAdapter,
        mockFathomStablecoin,
        mockSystemDebtEngine,
        mockedAccessControlConfig
      } = await loadFixture(loadFixtureHandler))
  })

  describe("#swapTokenToStablecoin", () => {
    context("when parameters are valid", () => {
      xit("should be able to call swapTokenToStablecoin", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        await mockAuthTokenAdapter.mock.deposit.withArgs(
          stableSwapModule.address,
          WeiPerWad.mul(10),
          AliceAddress
        ).returns()

        await mockBookKeeper.mock.adjustPosition.withArgs(
          formatBytes32String("WXDC"),
          stableSwapModule.address,
          stableSwapModule.address,
          stableSwapModule.address,
          WeiPerWad.mul(10),
          WeiPerWad.mul(10)
        ).returns()

        await mockBookKeeper.mock.moveStablecoin.withArgs(
          stableSwapModule.address,
          mockSystemDebtEngine.address,
          WeiPerWad.mul(WeiPerRay)
        ).returns()

        await mockStablecoinAdapter.mock.withdraw.withArgs(
          AliceAddress,
          WeiPerWad.mul(9),
          ethers.utils.defaultAbiCoder.encode(["uint256"], [0])
        ).returns()

        await stableSwapModule.setFeeIn(WeiPerWad.div(10))
        await expect(stableSwapModuleAsAlice.swapTokenToStablecoin(AliceAddress, WeiPerWad.mul(10)))
          .to.be.emit(stableSwapModule, "LogSwapTokenToStablecoin")
          .withArgs(AliceAddress, WeiPerWad.mul(10), WeiPerWad)
      })
    })
  })
  describe("#swapStablecoinToToken", () => {
    context("when failed transfer", () => {
      xit("should be revert", async () => {
        await expect(stableSwapModuleAsAlice.swapStablecoinToToken(AliceAddress, WeiPerWad.mul(10))).to.be.revertedWith(
          "!safeTransferFrom"
        )
      })
    })
    context("when parameters are valid", () => {
      xit("should be able to call swapStablecoinToToken", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        await stableSwapModule.setFeeOut(WeiPerWad.div(10))

        mockFathomStablecoin.mock.transferFrom.returns(true)

        await mockStablecoinAdapter.mock.deposit.withArgs(
          stableSwapModule.address,
          WeiPerWad.mul(11),
          ethers.utils.defaultAbiCoder.encode(["uint256"], [0])
        ).returns()

        await mockBookKeeper.mock.adjustPosition.withArgs(
          formatBytes32String("WXDC"),
          stableSwapModule.address,
          stableSwapModule.address,
          stableSwapModule.address,
          WeiPerWad.mul(-10),
          WeiPerWad.mul(-10)
        ).returns()

        await mockBookKeeper.mock.moveStablecoin.withArgs(
          stableSwapModule.address,
          mockSystemDebtEngine.address,
          WeiPerWad.mul(WeiPerRay)
        ).returns()

        await mockAuthTokenAdapter.mock.withdraw.withArgs(
          AliceAddress,
          WeiPerWad.mul(10)
        ).returns()

        await expect(stableSwapModuleAsAlice.swapStablecoinToToken(AliceAddress, WeiPerWad.mul(10)))
          .to.be.emit(stableSwapModule, "LogSwapStablecoinToToken")
          .withArgs(AliceAddress, WeiPerWad.mul(10), WeiPerWad)
      })
    })
  })
})
