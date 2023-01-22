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

  const ankrCollateralAdapter = getContract("AnkrCollateralAdapter", DeployerAddress)
  const ankrCollateralAdapterAsAlice = getContract("AnkrCollateralAdapter", AliceAddress)

  await ankrCollateralAdapter.initialize(
    mockedBookKeeper.address,
    formatBytes32String("BTCB"),
    mockedToken.address
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

describe("TokenAdapter", () => {
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
    context("when the token adapter is inactive", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        await ankrCollateralAdapter.cage()
        await expect(ankrCollateralAdapter.deposit(AliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith(
          "TokenAdapter/not-live"
        )
      })
    })

    context("when wad input is overflow (> MaxInt256)", () => {
      it("should revert", async () => {
        await expect(ankrCollateralAdapter.deposit(AliceAddress, ethers.constants.MaxUint256, "0x")).to.be.revertedWith(
          "TokenAdapter/overflow"
        )
      })
    })

    context("when transfer fail", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.addCollateral.returns()
        await expect(ankrCollateralAdapter.deposit(AliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith("!safeTransferFrom")
      })
    })

    context("when parameters are valid", () => {
      it("should be able to call bookkeeper.addCollateral() correctly", async () => {
        await mockedBookKeeper.mock.addCollateral.withArgs(
          formatBytes32String("BTCB"),
          AliceAddress,
          BigNumber.from("1000000000000000000")
        ).returns()
        await mockedToken.mock.transferFrom.withArgs(
          DeployerAddress,
          ankrCollateralAdapter.address,
          BigNumber.from("1000000000000000000")
        ).returns(true)
        await ankrCollateralAdapter.deposit(AliceAddress, WeiPerWad.mul(1), "0x")
      })
    })
  })

  describe("#withdraw()", () => {
    context("when wad input is overflow (> MaxInt256)", () => {
      it("should revert", async () => {
        await expect(ankrCollateralAdapter.withdraw(AliceAddress, ethers.constants.MaxUint256, "0x")).to.be.revertedWith(
          "TokenAdapter/overflow"
        )
      })
    })

    context("when transfer fail", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.addCollateral.returns()
        await expect(ankrCollateralAdapter.withdraw(AliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith("!safeTransfer")
      })
    })

    context("when parameters are valid", () => {
      it("should be able to call bookkeeper.addCollateral() correctly", async () => {
        await mockedBookKeeper.mock.addCollateral.withArgs(
          formatBytes32String("BTCB"),
          DeployerAddress,
          BigNumber.from("-1000000000000000000")
        ).returns()
        await mockedToken.mock.transfer.withArgs(
          AliceAddress,
          BigNumber.from("1000000000000000000")
        ).returns(true)
        await ankrCollateralAdapter.withdraw(AliceAddress, WeiPerWad.mul(1), "0x")
      })
    })
  })

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(ankrCollateralAdapterAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
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

        await expect(ankrCollateralAdapterAsAlice.uncage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
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
