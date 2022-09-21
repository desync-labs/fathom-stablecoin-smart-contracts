require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");
const { WeiPerWad } = require("../../helper/unit");
const AssertHelpers = require("../../helper/assert");
const { latest } = require("../../helper/time");

chai.use(smock.matchers)
const { expect } = chai
const { AddressZero } = ethers.constants
const { formatBytes32String } = ethers.utils

const loadFixtureHandler = async () => {
  const [deployer] = await ethers.getSigners()

  const mockedAccessControlConfig = await smock.fake("AccessControlConfig");
  const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
  const mockedBookKeeper = await smock.fake("BookKeeper");
  const mockedToken = await smock.fake("ERC20");

  mockedToken.decimals.returns(18)

  // Deploy TokenAdapter
  const TokenAdapter = (await ethers.getContractFactory("TokenAdapter", deployer))
  const tokenAdapter = (await upgrades.deployProxy(TokenAdapter, [
    mockedBookKeeper.address,
    formatBytes32String("BTCB"),
    mockedToken.address,
  ]))
  await tokenAdapter.deployed()

  return { tokenAdapter, mockedBookKeeper, mockedToken, mockedAccessControlConfig, mockedCollateralPoolConfig }
}

describe("TokenAdapter", () => {
  // Accounts
  let deployer
  let alice
  let bob
  let dev

  // Account Addresses
  let deployerAddress
  let aliceAddress
  let bobAddress
  let devAddress

  //Contract
  let tokenAdapter
  let mockedBookKeeper
  let mockedToken
  let mockedAccessControlConfig
  let mockedCollateralPoolConfig
  let tokenAdapterAsAlice

  beforeEach(async () => {
    ;({ tokenAdapter, mockedBookKeeper, mockedToken, mockedAccessControlConfig, mockedCollateralPoolConfig } =
      await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])

    tokenAdapterAsAlice = tokenAdapter.connect(alice)
  })

  describe("#deposit()", () => {
    context("when the token adapter is inactive", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await tokenAdapter.cage()
        await expect(tokenAdapter.deposit(aliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith(
          "TokenAdapter/not-live"
        )
      })
    })

    context("when wad input is overflow (> MaxInt256)", () => {
      it("should revert", async () => {
        await expect(tokenAdapter.deposit(aliceAddress, ethers.constants.MaxUint256, "0x")).to.be.revertedWith(
          "TokenAdapter/overflow"
        )
      })
    })

    context("when transfer fail", () => {
      it("should revert", async () => {
        await expect(tokenAdapter.deposit(aliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith("!safeTransferFrom")
      })
    })

    context("when parameters are valid", () => {
      it("should be able to call bookkeeper.addCollateral() correctly", async () => {
        mockedBookKeeper.addCollateral.reset()
        mockedToken.transferFrom.reset()

        mockedBookKeeper.addCollateral.returns()
        mockedToken.transferFrom.returns(true)
        await tokenAdapter.deposit(aliceAddress, WeiPerWad.mul(1), "0x")

        expect(mockedBookKeeper.addCollateral).to.be.calledOnceWith(formatBytes32String("BTCB"), aliceAddress, BigNumber.from("1000000000000000000"))
        expect(mockedToken.transferFrom).to.be.calledOnceWith(deployerAddress, tokenAdapter.address, BigNumber.from("1000000000000000000"))
      })
    })
  })

  describe("#withdraw()", () => {
    context("when wad input is overflow (> MaxInt256)", () => {
      it("should revert", async () => {
        await expect(tokenAdapter.withdraw(aliceAddress, ethers.constants.MaxUint256, "0x")).to.be.revertedWith(
          "TokenAdapter/overflow"
        )
      })
    })

    context("when transfer fail", () => {
      it("should revert", async () => {
        await expect(tokenAdapter.withdraw(aliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith("!safeTransfer")
      })
    })

    context("when parameters are valid", () => {
      it("should be able to call bookkeeper.addCollateral() correctly", async () => {
        mockedBookKeeper.addCollateral.reset()
        mockedToken.transfer.reset()

        mockedBookKeeper.addCollateral.returns()
        mockedToken.transfer.returns(true)
        await tokenAdapter.withdraw(aliceAddress, WeiPerWad.mul(1), "0x")

        expect(mockedBookKeeper.addCollateral).to.be.calledOnceWith(formatBytes32String("BTCB"), deployerAddress, BigNumber.from("-1000000000000000000"))
        expect(mockedToken.transfer).to.be.calledOnceWith(aliceAddress, BigNumber.from("1000000000000000000"))
      })
    })
  })

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(tokenAdapterAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await tokenAdapterAsAlice.live()).to.be.equal(1)

          await expect(tokenAdapterAsAlice.cage()).to.emit(tokenAdapterAsAlice, "LogCage").withArgs()

          expect(await tokenAdapterAsAlice.live()).to.be.equal(0)
        })
      })

      context("caller is showStopper role", () => {
        it("should be set live to 0", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await tokenAdapterAsAlice.live()).to.be.equal(1)

          await expect(tokenAdapterAsAlice.cage()).to.emit(tokenAdapterAsAlice, "LogCage").withArgs()

          expect(await tokenAdapterAsAlice.live()).to.be.equal(0)
        })
      })
    })
  })

  describe("#uncage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(tokenAdapterAsAlice.uncage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 1", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await tokenAdapterAsAlice.live()).to.be.equal(1)

          await tokenAdapterAsAlice.cage()

          expect(await tokenAdapterAsAlice.live()).to.be.equal(0)

          await expect(tokenAdapterAsAlice.uncage()).to.emit(tokenAdapterAsAlice, "LogUncage").withArgs()

          expect(await tokenAdapterAsAlice.live()).to.be.equal(1)
        })
      })

      context("caller is showStopper role", () => {
        it("should be set live to 1", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await tokenAdapterAsAlice.live()).to.be.equal(1)

          await tokenAdapterAsAlice.cage()

          expect(await tokenAdapterAsAlice.live()).to.be.equal(0)

          await expect(tokenAdapterAsAlice.uncage()).to.emit(tokenAdapterAsAlice, "LogUncage").withArgs()

          expect(await tokenAdapterAsAlice.live()).to.be.equal(1)
        })
      })
    })
  })
})
