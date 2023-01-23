const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const pools = require("../../../common/collateral");
const { getProxy } = require("../../../common/proxies");


// const { getAddresses } = require("../../../common/addresses");

const { formatBytes32String } = ethers.utils

const { DeployerAddress, AliceAddress, BobAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerWad } = require("../../helper/unit");
const { loadFixture } = require("../../helper/fixtures");



// const addresses = getAddresses(deployer.networkId())

const loadFixtureHandler = async () => {
  const mockedAccessControlConfig = await createMock("AccessControlConfig");
  const mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
  const mockedBookKeeper = await createMock("BookKeeper");
  const mockedPositionManager = await createMock("PositionManager");
  const mockedToken = await createMock("ERC20Mintable");

  await mockedToken.mock.decimals.returns(18)
  await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
  await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))
  await mockedAccessControlConfig.mock.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"))
  await mockedAccessControlConfig.mock.hasRole.returns(true)

  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

  const ankrCollateralAdapter = getContract("AnkrCollateralAdapter", DeployerAddress)
  const ankrCollateralAdapterAsAlice = getContract("AnkrCollateralAdapter", AliceAddress)
  const ProxyWalletFactory = artifacts.require('./main/proxy-wallet/ProxyWalletFactory.sol');

  const xdcPool = await artifacts.initializeInterfaceAt("MockXDCStakingPool", "MockXDCStakingPool");
  const aXDCc = await artifacts.initializeInterfaceAt("MockaXDCc", "MockaXDCc");


  await ankrCollateralAdapter.initialize(
    mockedBookKeeper.address,
    pools.XDC,
    xdcPool.address,
    aXDCc.address,
    mockedPositionManager.address,
    ProxyWalletFactory.address
  )
  return {
    ankrCollateralAdapter,
    ankrCollateralAdapterAsAlice,
    mockedBookKeeper,
    mockedToken,
    mockedAccessControlConfig,
    mockedCollateralPoolConfig
  }
}

describe("AnkrCollateralAdapter", () => {
  //Contract
  let ankrCollateralAdapter
  let mockedBookKeeper
  let mockedToken
  let mockedAccessControlConfig
  let mockedCollateralPoolConfig
  let ankrCollateralAdapterAsAlice

  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => {
    ; ({
      ankrCollateralAdapter,
      ankrCollateralAdapterAsAlice,
      mockedBookKeeper,
      mockedToken,
      mockedAccessControlConfig,
      mockedCollateralPoolConfig
    } = await loadFixture(loadFixtureHandler))
  })

  describe("#deposit()", () => {
    context("Directly calling AnkrCollateralAdapter", () => {
      it("should revert", async () => {
        await expect(ankrCollateralAdapter.deposit(AliceAddress, WeiPerWad.mul(1), "0x", { value: WeiPerWad.mul(1) })).to.be.revertedWith(
          "!ProxyOrWL"
        )
      })
    })
  })


  describe("#withdraw()", () => {
    context("Directly calling AnkrCollateralAdapter", () => {
      it("should revert", async () => {
        await expect(ankrCollateralAdapter.withdraw(AliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith(
          "!ProxyOrWL"
        )
      })
    })
  })

  describe("#moveStake()", () => {
    context("Directly calling AnkrCollateralAdapter", () => {
      it("should revert", async () => {
        await expect(ankrCollateralAdapter.moveStake(AliceAddress, AliceAddress,WeiPerWad.mul(1), "0x")).to.be.revertedWith(
          "!ProxyOrWL"
        )
      })
    })
  })

  describe("#onAdjustPosition()", () => {
    context("Directly calling AnkrCollateralAdapter", () => {
      it("should revert", async () => {
        await expect(ankrCollateralAdapter.onAdjustPosition(AliceAddress, AliceAddress, WeiPerWad.mul(1), WeiPerWad.mul(1), "0x")).to.be.revertedWith(
          "!ProxyOrWL"
        )
      })
    })
  })

  describe("#onMoveCollateral()", () => {
    context("Directly calling AnkrCollateralAdapter", () => {
      it("should revert", async () => {
        await expect(ankrCollateralAdapter.onMoveCollateral(AliceAddress, AliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith(
          "!ProxyOrWL"
        )
      })
    })
  })

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(ankrCollateralAdapterAsAlice.cage()).to.be.revertedWith("AnkrCollateralAdapter/not-authorized")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          expect(await ankrCollateralAdapterAsAlice.live()).to.be.equal(1)

          await expect(ankrCollateralAdapterAsAlice.cage()).to.emit(ankrCollateralAdapterAsAlice, "LogCage").withArgs()

          expect(await ankrCollateralAdapterAsAlice.live()).to.be.equal(0)
        })
      })

      context("caller is showStopper role", () => {
        it("should be set live to 0", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          expect(await ankrCollateralAdapterAsAlice.live()).to.be.equal(1)

          await expect(ankrCollateralAdapterAsAlice.cage()).to.emit(ankrCollateralAdapterAsAlice, "LogCage").withArgs()

          expect(await ankrCollateralAdapterAsAlice.live()).to.be.equal(0)
        })
      })
    })
  })

  describe("#uncage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(ankrCollateralAdapterAsAlice.uncage()).to.be.revertedWith("!ownerRole")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 1", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          expect(await ankrCollateralAdapterAsAlice.live()).to.be.equal(1)

          await ankrCollateralAdapterAsAlice.cage()

          expect(await ankrCollateralAdapterAsAlice.live()).to.be.equal(0)

          await expect(ankrCollateralAdapterAsAlice.uncage()).to.emit(ankrCollateralAdapterAsAlice, "LogUncage").withArgs()

          expect(await ankrCollateralAdapterAsAlice.live()).to.be.equal(1)
        })
      })

      context("caller is showStopper role", () => {
        it("should be set live to 1", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          expect(await ankrCollateralAdapterAsAlice.live()).to.be.equal(1)

          await ankrCollateralAdapterAsAlice.cage()

          expect(await ankrCollateralAdapterAsAlice.live()).to.be.equal(0)

          await expect(ankrCollateralAdapterAsAlice.uncage()).to.emit(ankrCollateralAdapterAsAlice, "LogUncage").withArgs()

          expect(await ankrCollateralAdapterAsAlice.live()).to.be.equal(1)
        })
      })
    })
  })
})
