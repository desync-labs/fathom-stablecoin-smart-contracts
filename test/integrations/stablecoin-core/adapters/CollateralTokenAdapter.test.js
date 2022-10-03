require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { BigNumber } = require("ethers");

const { weiToRay } = require("../../../helper/unit");
const { advanceBlock } = require("../../../helper/time");
const { parseEther, formatBytes32String } = require("ethers/lib/utils");

const { expect } = chai
const { AddressZero } = ethers.constants

const FATHOM_PER_BLOCK = parseEther("100")
const COLLATERAL_POOL_ID = formatBytes32String("ibDUMMY")

const loadFixtureHandler = async () => {
  const [deployer, alice, bob, dev] = await ethers.getSigners()

  const AccessControlConfig = (await ethers.getContractFactory(
    "AccessControlConfig",
    deployer
  ))
  const accessControlConfig = (await upgrades.deployProxy(AccessControlConfig, []))

  const CollateralPoolConfig = (await ethers.getContractFactory(
    "CollateralPoolConfig",
    deployer
  ))
  const collateralPoolConfig = (await upgrades.deployProxy(CollateralPoolConfig, [
    accessControlConfig.address,
  ]))

  // Deploy mocked BookKeeper
  const BookKeeper = (await ethers.getContractFactory("BookKeeper", deployer))
  const bookKeeper = (await upgrades.deployProxy(BookKeeper, [
    collateralPoolConfig.address,
    accessControlConfig.address,
  ]))
  await bookKeeper.deployed()

  // Deploy mocked BEP20
  const BEP20 = (await ethers.getContractFactory("BEP20", deployer))
  const ibDUMMY = await BEP20.deploy("ibDUMMY", "ibDUMMY")
  await ibDUMMY.deployed()
  await ibDUMMY.mint(await alice.getAddress(), ethers.utils.parseEther("100"))
  await ibDUMMY.mint(await bob.getAddress(), ethers.utils.parseEther("100"))

  // Deploy Fathom's Fairlaunch
  const FathomToken = (await ethers.getContractFactory("FathomToken", deployer))
  const fathomToken = await FathomToken.deploy(88, 89)
  await fathomToken.mint(await deployer.getAddress(), ethers.utils.parseEther("150"))
  await fathomToken.deployed()

  const FairLaunch = (await ethers.getContractFactory("FairLaunch", deployer))
  const fairLaunch = await FairLaunch.deploy(
    fathomToken.address,
    await deployer.getAddress(),
    FATHOM_PER_BLOCK,
    0,
    0,
    0
  )
  await fairLaunch.deployed()

  const Shield = (await ethers.getContractFactory("Shield", deployer))
  const shield = await Shield.deploy(deployer.address, fairLaunch.address)
  await shield.deployed()

  // Config Fathom's FairLaunch
  // Assuming Deployer is timelock for easy testing
  await fairLaunch.addPool(1, ibDUMMY.address, true)
  await fairLaunch.transferOwnership(shield.address)
  await shield.transferOwnership(await deployer.getAddress())
  await fathomToken.transferOwnership(fairLaunch.address)

  // Deploy PositionManager
  const PositionManager = (await ethers.getContractFactory("PositionManager", deployer))
  const positionManager = (await upgrades.deployProxy(PositionManager, [
    bookKeeper.address,
    bookKeeper.address,
  ]))
  await positionManager.deployed()
  await accessControlConfig.grantRole(await accessControlConfig.POSITION_MANAGER_ROLE(), positionManager.address)
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), positionManager.address)

  const CollateralTokenAdapter = (await ethers.getContractFactory("CollateralTokenAdapter", deployer))
  const collateralTokenAdapter = (await upgrades.deployProxy(CollateralTokenAdapter, [
    bookKeeper.address,
    COLLATERAL_POOL_ID,
    ibDUMMY.address,
    fathomToken.address,
    fairLaunch.address,
    0,
    shield.address,
    await deployer.getAddress(),
    BigNumber.from(1000),
    await dev.getAddress(),
    positionManager.address,
  ]))
  await collateralTokenAdapter.deployed()

  await accessControlConfig.grantRole(
    ethers.utils.solidityKeccak256(["string"], ["ADAPTER_ROLE"]),
    collateralTokenAdapter.address
  )

  return {
    collateralTokenAdapter,
    bookKeeper,
    ibDUMMY,
    shield,
    fathomToken,
    fairLaunch,
  }
}

describe("CollateralTokenAdapter", () => {
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

  // Contracts
  let collateralTokenAdapter
  let bookKeeper
  let ibDUMMY
  let shield
  let fathomToken
  let fairLaunch

  // Signer
  let collateralTokenAdapterAsAlice
  let collateralTokenAdapterAsBob

  let ibDUMMYasAlice
  let ibDUMMYasBob

  beforeEach(async () => {
    ;({ collateralTokenAdapter, bookKeeper, ibDUMMY, shield, fathomToken, fairLaunch } = await waffle.loadFixture(
      loadFixtureHandler
    ))
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])

    collateralTokenAdapterAsAlice = collateralTokenAdapter.connect(alice)
    collateralTokenAdapterAsBob = collateralTokenAdapter.connect(bob)

    ibDUMMYasAlice = ibDUMMY.connect(alice)
    ibDUMMYasBob = ibDUMMY.connect(bob)
  })

  describe("#initialize", async () => {
    context("when collateralToken not match with FairLaunch", async () => {
      it("should revert", async () => {
        const CollateralTokenAdapter = (await ethers.getContractFactory("CollateralTokenAdapter", deployer))
        await expect(
          upgrades.deployProxy(CollateralTokenAdapter, [
            bookKeeper.address,
            COLLATERAL_POOL_ID,
            fathomToken.address,
            fathomToken.address,
            fairLaunch.address,
            0,
            shield.address,
            deployerAddress,
            BigNumber.from(1000),
            deployerAddress,
            deployerAddress,
          ])
        ).to.be.revertedWith("CollateralTokenAdapter/collateralToken-not-match")
      })
    })

    context("when rewardToken not match with FairLaunch", async () => {
      it("should revert", async () => {
        const CollateralTokenAdapter = (await ethers.getContractFactory("CollateralTokenAdapter", deployer))
        await expect(
          upgrades.deployProxy(CollateralTokenAdapter, [
            bookKeeper.address,
            COLLATERAL_POOL_ID,
            ibDUMMY.address,
            ibDUMMY.address,
            fairLaunch.address,
            0,
            shield.address,
            deployerAddress,
            BigNumber.from(1000),
            deployerAddress,
            deployerAddress,
          ])
        ).to.be.revertedWith("CollateralTokenAdapter/reward-token-not-match")
      })
    })

    context("when shield not match with FairLaunch", async () => {
      it("should revert", async () => {
        const CollateralTokenAdapter = (await ethers.getContractFactory("CollateralTokenAdapter", deployer))
        await expect(
          upgrades.deployProxy(CollateralTokenAdapter, [
            bookKeeper.address,
            COLLATERAL_POOL_ID,
            ibDUMMY.address,
            fathomToken.address,
            fairLaunch.address,
            0,
            deployerAddress,
            deployerAddress,
            BigNumber.from(1000),
            deployerAddress,
            deployerAddress,
          ])
        ).to.be.revertedWith("CollateralTokenAdapter/shield-not-match")
      })
    })

    context("when timelock not match with FairLaunch", async () => {
      it("should revert", async () => {
        const CollateralTokenAdapter = (await ethers.getContractFactory("CollateralTokenAdapter", deployer))
        await expect(
          upgrades.deployProxy(CollateralTokenAdapter, [
            bookKeeper.address,
            COLLATERAL_POOL_ID,
            ibDUMMY.address,
            fathomToken.address,
            fairLaunch.address,
            0,
            shield.address,
            shield.address,
            BigNumber.from(1000),
            deployerAddress,
            deployerAddress,
          ])
        ).to.be.revertedWith("CollateralTokenAdapter/timelock-not-match")
      })
    })

    context("when all assumptions are correct", async () => {
      it("should initalized correctly", async () => {
        expect(await collateralTokenAdapter.bookKeeper()).to.be.eq(bookKeeper.address)
        expect(await collateralTokenAdapter.collateralPoolId()).to.be.eq(COLLATERAL_POOL_ID)
        expect(await collateralTokenAdapter.collateralToken()).to.be.eq(ibDUMMY.address)
        expect(await collateralTokenAdapter.fairlaunch()).to.be.eq(fairLaunch.address)
        expect(await collateralTokenAdapter.pid()).to.be.eq(0)
        expect(await collateralTokenAdapter.shield()).to.be.eq(shield.address)
        expect(await collateralTokenAdapter.timelock()).to.be.eq(deployerAddress)
        expect(await collateralTokenAdapter.decimals()).to.be.eq(18)
      })
    })
  })

  describe("#netAssetValuation", async () => {
    context("when all collateral tokens are deposited by deposit function", async () => {
      it("should return the correct net asset valuation", async () => {
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await collateralTokenAdapter.netAssetValuation()).to.be.eq(ethers.utils.parseEther("1"))

        await collateralTokenAdapterAsAlice.withdraw(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )
        expect(await collateralTokenAdapter.netAssetValuation()).to.be.eq(0)
      })
    })

    context("when some one directly transfer collateral tokens to CollateralTokenAdapter", async () => {
      it("should only recognized collateral tokens from deposit function", async () => {
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        await ibDUMMYasBob.transfer(collateralTokenAdapter.address, ethers.utils.parseEther("88"))

        expect(await ibDUMMY.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
        expect(await collateralTokenAdapter.netAssetValuation()).to.be.eq(ethers.utils.parseEther("1"))

        await collateralTokenAdapterAsAlice.withdraw(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await ibDUMMY.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
        expect(await collateralTokenAdapter.netAssetValuation()).to.be.eq(0)
      })
    })
  })

  describe("#netAssetPerShare", async () => {
    context("when all collateral tokens are deposited by deposit function", async () => {
      it("should return the correct net asset per share", async () => {
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        // Expect netAssetPerShare = 1 as share = asset
        expect(await collateralTokenAdapter.netAssetPerShare()).to.be.eq(ethers.utils.parseEther("1"))

        await collateralTokenAdapterAsAlice.withdraw(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        // If total share = 0, the net asset per share = WAD
        expect(await collateralTokenAdapter.netAssetPerShare()).to.be.eq(ethers.utils.parseEther("1"))
      })
    })

    context("when some one directly transfer collateral tokens to CollateralTokenAdapter", async () => {
      it("should only recognized collateral tokens from deposit function", async () => {
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        await ibDUMMYasBob.transfer(collateralTokenAdapter.address, ethers.utils.parseEther("88"))

        expect(await ibDUMMY.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
        expect(await collateralTokenAdapter.netAssetPerShare()).to.be.eq(ethers.utils.parseEther("1"))

        await collateralTokenAdapterAsAlice.withdraw(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )
        expect(await ibDUMMY.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
        // If total share = 0, the net asset per share = WAD
        expect(await collateralTokenAdapter.netAssetPerShare()).to.be.eq(ethers.utils.parseEther("1"))
      })
    })
  })

  describe("#deposit", async () => {
    context("when CollateralTokenAdapter is not live", async () => {
      it("should revert", async () => {
        // Cage collateralTokenAdapter
        await collateralTokenAdapter.cage()
        await expect(
          collateralTokenAdapter.deposit(
            deployerAddress,
            ethers.utils.parseEther("1"),
            ethers.utils.defaultAbiCoder.encode(["address"], [deployerAddress])
          )
        ).to.be.revertedWith("CollateralTokenAdapter/not live")
      })
    })

    context("when all parameters are valid", async () => {
      it("should work", async () => {
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

        // Now Alice harvest rewards. 1 block has been passed, hence Alice should get 90 (100 - 10%) FATHOM, treasury account should get 10 FATHOM.
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          0,
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(ethers.utils.parseEther("90"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("100")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("0"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(ethers.utils.parseEther("100"))
        expect(await fathomToken.balanceOf(devAddress)).to.be.eq(ethers.utils.parseEther("10"))

        // Bob join the party! As 2 blocks moved. CollateralTokenAdapter earned 200 FATHOM
        await ibDUMMYasBob.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"))
        await collateralTokenAdapterAsBob.deposit(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(ethers.utils.parseEther("90"))
        expect(await fathomToken.balanceOf(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("300")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(ethers.utils.parseEther("100"))
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("1200"))
        expect(await fathomToken.balanceOf(devAddress)).to.be.eq(ethers.utils.parseEther("10"))

        // Bob harvest FATHOM. CollateralTokenAdapter earned another 100 FATHOM.
        // CollateralTokenAdapter has another 100 FATHOM from previous block. Hence,
        // balanceOf(address(this)) should return 300 FATHOM.
        // Bob should get 72 (80 - 10%) FATHOM, treasury account should get 8 FATHOM.
        await collateralTokenAdapterAsBob.deposit(bobAddress, 0, ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]))

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("220"))
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(ethers.utils.parseEther("90"))
        expect(await fathomToken.balanceOf(bobAddress)).to.be.eq(ethers.utils.parseEther("72"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("320")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("220"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(ethers.utils.parseEther("100"))
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("1280"))
        expect(await fathomToken.balanceOf(devAddress)).to.be.eq(ethers.utils.parseEther("18"))
      })
    })
  })

  describe("#withdraw", async () => {
    context("when withdraw more than what CollateralTokenAdapter staked", async () => {
      it("should revert", async () => {
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        await expect(
          collateralTokenAdapterAsAlice.withdraw(
            aliceAddress,
            ethers.utils.parseEther("100"),
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
          )
        ).to.be.revertedWith("withdraw: not good")
      })
    })

    context("when withdraw more than what he staked", async () => {
      it("should revert", async () => {
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        await ibDUMMYasBob.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"))
        await collateralTokenAdapterAsBob.deposit(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )

        await expect(
          collateralTokenAdapterAsAlice.withdraw(
            aliceAddress,
            ethers.utils.parseEther("2"),
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
          )
        ).to.be.revertedWith("CollateralTokenAdapter/insufficient staked amount")
      })
    })

    context("when CollateralTokenAdapter is not live", async () => {
      it("should still allow user to withdraw", async () => {
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

        // Cage CollateralTokenAdapter
        await collateralTokenAdapter.cage()
        expect(await collateralTokenAdapter.live()).to.be.eq(0)

        // Now Alice withdraw her position. 4 blocks have been passed.
        // CollateralTokenAdapter is caged, non of FATHOM has been harvested.
        // Staked collateralTokens have been emergencyWithdraw from FairLaunch.
        // The following conditions must be satisfy:
        // - Alice should get 0 FATHOM as cage before FATHOM get harvested.
        // - Alice should get 1 ibDUMMY back.
        let aliceIbDUMMYbefore = await ibDUMMY.balanceOf(aliceAddress)
        await collateralTokenAdapterAsAlice.withdraw(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )
        let aliceIbDUMMYafter = await ibDUMMY.balanceOf(aliceAddress)

        expect(aliceIbDUMMYafter.sub(aliceIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
      })

      it("should still allow user to withdraw with pending rewards (if any)", async () => {
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

        // Bob join the party with 4 ibDUMMY! 2 Blocks have been passed.
        // CollateralTokenAdapter should earned 200 FATHOM
        await ibDUMMYasBob.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"))
        await collateralTokenAdapterAsBob.deposit(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(0)
        expect(await fathomToken.balanceOf(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("800"))

        // Move 1 block so CollateralTokenAdapter make 100 FATHOM. However this portion
        // won't be added as CollateralTokenAdapter cage before it get harvested.
        await advanceBlock()

        // Cage CollateralTokenAdapter
        await collateralTokenAdapter.cage()
        expect(await collateralTokenAdapter.live()).to.be.eq(0)

        // Now Alice withdraw her position. Only 200 FATHOM has been harvested from FairLaunch.
        // CollateralTokenAdapter is caged. Staked collateralTokens have been emergencyWithdraw from FairLaunch.
        // The following conditions must be satisfy:
        // - Alice pending rewards must be 200 FATHOM
        // - Bob pending rewards must be 0 FATHOM as all rewards after Bob deposited hasn't been harvested.
        // - Alice should get 180 (200 - 10%) FATHOM that is harvested before cage (when Bob deposited)
        // - Alice should get 1 ibDUMMY back.
        // - treasury account should get 20 FATHOM.
        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.pendingRewards(bobAddress)).to.be.eq(0)

        let aliceIbDUMMYbefore = await ibDUMMY.balanceOf(aliceAddress)
        await collateralTokenAdapterAsAlice.withdraw(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )
        let aliceIbDUMMYafter = await ibDUMMY.balanceOf(aliceAddress)

        expect(aliceIbDUMMYafter.sub(aliceIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(ethers.utils.parseEther("180"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("800"))
        expect(await fathomToken.balanceOf(devAddress)).to.be.eq(ethers.utils.parseEther("20"))

        let bobIbDUMMYbefore = await ibDUMMY.balanceOf(bobAddress)
        await collateralTokenAdapterAsBob.withdraw(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )
        let bobIbDUMMYafter = await ibDUMMY.balanceOf(bobAddress)

        expect(bobIbDUMMYafter.sub(bobIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(ethers.utils.parseEther("180"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(0)
      })
    })

    context("when all parameters are valid", async () => {
      it("should work", async () => {
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

        // Now Alice withdraw her position. 1 block has been passed, hence Alice should get 90 (100 - 10%) FATHOM, treasury account should get 10 FATHOM.
        let aliceIbDUMMYbefore = await ibDUMMY.balanceOf(aliceAddress)
        await collateralTokenAdapterAsAlice.withdraw(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )
        let aliceIbDUMMYafter = await ibDUMMY.balanceOf(aliceAddress)

        expect(aliceIbDUMMYafter.sub(aliceIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(ethers.utils.parseEther("90"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("100")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await fathomToken.balanceOf(devAddress)).to.be.eq(ethers.utils.parseEther("10"))
      })
    })
    context("when bob withdraw collateral to alice", async () => {
      context("when bob doesn't has collateral", () => {
        it("should be revert", async () => {
          // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
          await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
          await collateralTokenAdapterAsAlice.deposit(
            aliceAddress,
            ethers.utils.parseEther("1"),
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
          )

          await expect(
            collateralTokenAdapterAsBob.withdraw(
              aliceAddress,
              ethers.utils.parseEther("1"),
              ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
            )
          ).to.be.revertedWith("CollateralTokenAdapter/insufficient staked amount")
        })
      })
      context("when bob has collateral", async () => {
        it("should be able to call withdraw", async () => {
          await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
          await collateralTokenAdapterAsAlice.deposit(
            aliceAddress,
            ethers.utils.parseEther("1"),
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
          )

          expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
          expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
          expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
          expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
          expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
          expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

          await ibDUMMYasBob.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
          await collateralTokenAdapterAsBob.deposit(
            bobAddress,
            ethers.utils.parseEther("1"),
            ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
          )

          let aliceIbDUMMYbefore = await ibDUMMY.balanceOf(aliceAddress)
          let bobIbDUMMYbefore = await ibDUMMY.balanceOf(bobAddress)
          await collateralTokenAdapterAsBob.withdraw(aliceAddress, ethers.utils.parseEther("1"), "0x")
          let aliceIbDUMMYafter = await ibDUMMY.balanceOf(aliceAddress)
          let bobIbDUMMYafter = await ibDUMMY.balanceOf(bobAddress)

          expect(aliceIbDUMMYafter.sub(aliceIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("1"))
          expect(bobIbDUMMYafter.sub(bobIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("0"))
          expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("250"))
          expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq("0")
          expect(await fathomToken.balanceOf(bobAddress)).to.be.eq(ethers.utils.parseEther("45"))
        })
      })
    })
  })

  describe("#emergencyWithdraw", async () => {
    context("when CollateralTokenAdapter is not live", async () => {
      it("should allow users to exit with emergencyWithdraw and normal withdraw", async () => {
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

        // Bob join the party with 4 ibDUMMY! 2 Blocks have been passed.
        // CollateralTokenAdapter should earned 200 FATHOM
        await ibDUMMYasBob.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"))
        await collateralTokenAdapterAsBob.deposit(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(0)
        expect(await fathomToken.balanceOf(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("800"))

        // Move 1 block so CollateralTokenAdapter make 100 FATHOM. However this portion
        // won't be added as CollateralTokenAdapter cage before it get harvested.
        await advanceBlock()

        // Cage CollateralTokenAdapter
        await collateralTokenAdapter.cage()
        expect(await collateralTokenAdapter.live()).to.be.eq(0)

        // CollateralTokenAdapter is caged. Staked collateralTokens have been emergencyWithdraw from FairLaunch.
        // Only 200 FATHOM has been harvested from FairLaunch.
        // The following conditions must be satisfy:
        // - Alice pending rewards must be 200 FATHOM
        // - Bob pending rewards must be 0 FATHOM as all rewards after Bob deposited hasn't been harvested.
        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.pendingRewards(bobAddress)).to.be.eq(0)

        // Alice panic and decided to emergencyWithdraw.
        // The following states are expected:
        // - collateralTokenAdapte should still has 200 FATHOM as Alice dismiss her rewards
        // - Alice should not get any FATHOM as she decided to do exit via emergency withdraw instead of withdraw
        // - Alice should get 1 ibDUMMY back.
        let aliceIbDUMMYbefore = await ibDUMMY.balanceOf(aliceAddress)
        await collateralTokenAdapterAsAlice.emergencyWithdraw(aliceAddress)
        let aliceIbDUMMYafter = await ibDUMMY.balanceOf(aliceAddress)

        expect(aliceIbDUMMYafter.sub(aliceIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("800"))

        // Bob is a cool guy. Not panic and withdraw normal.
        // The following states are expected:
        // - Bob should get his 4 ibDUMMY back
        // - Bob hasn't earn any FATHOM yet so he didn't get any FATHOM
        // - CollateralTokenAdapter should still has 200 FATHOM that Alice dismissed
        let bobIbDUMMYbefore = await ibDUMMY.balanceOf(bobAddress)
        await collateralTokenAdapterAsBob.withdraw(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )
        let bobIbDUMMYafter = await ibDUMMY.balanceOf(bobAddress)

        expect(bobIbDUMMYafter.sub(bobIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(0)
        expect(await fathomToken.balanceOf(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(0)
      })
    })

    context("when all states are normal", async () => {
      it("should work", async () => {
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

        // Alice feels in-secure, so she does emergencyWithdraw
        // The following conditions must be satisfied:
        // - Alice should get here 1 ibDUMMY back
        // - Alice shouldn't be paid by any FATHOM
        // - Alice's state should be reset
        let aliceIbDUMMYbefore = await ibDUMMY.balanceOf(aliceAddress)
        await collateralTokenAdapterAsAlice.emergencyWithdraw(aliceAddress)
        let aliceIbDUMMYafter = await ibDUMMY.balanceOf(aliceAddress)

        expect(aliceIbDUMMYafter.sub(aliceIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("100"))
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
      })
    })
  })

  describe("#pendingRewards", async () => {
    context("when CollateralTokenAdapter doesn't has any collateralTokens", async () => {
      it("should returns 0 pending FATHOM", async () => {
        expect(await collateralTokenAdapter.pendingRewards(deployerAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.pendingRewards(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.pendingRewards(devAddress)).to.be.eq(0)
      })
    })

    context("when CollateralTokenAdapter is not live", async () => {
      it("should return correct pending FATHOM for each user", async () => {
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

        // Bob deposit to collateralTokenAdapter, 2 blocks have passed. Hence collateralTokenAdapter should earned 200 FATHOM.
        await ibDUMMYasBob.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"))
        await collateralTokenAdapterAsBob.deposit(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )

        // The following conditions must be satisfy:
        // - collateralTokenAdapter must has 200 FATHOM as deposit trigger harvest
        // - collateralTokenAdapter.totalShare() must be 5 as Alice deposited 1 ibDUMMY + Bob deposited 4 ibDUMMY
        // - collateralTokenAdapter.accRewardPerShare() must be 200 as 0 + (2*100)/1 = 200
        // - collateralTokenAdapter.accRewardBalance() must be 200 as none of the rewards have been harvested
        // - collateralTokenAdapter.stake(alice) must be 1 ibDUMMY
        // - collateralTokenAdapter.rewardDebts(alice) must be 0
        // - collateralTokenAdapter.stake(bob) must be 4 ibDUMMY
        // - collateralTokenAdapter.rewardDebts(bob) must be 800
        // - collateralTokenAdapter.pendingRewards(alice) must be 200 FATHOM as she deposited 2 block ago
        // - collateralTokenAdapter.pendingRewards(bob) must be 0 FATHOM as he just deposited this block
        // - collateralTokenAdapter.pendingRewards(deployer) must be 0 FATHOM as he doesn't do anything
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("800"))

        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.pendingRewards(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.pendingRewards(deployerAddress)).to.be.eq(0)

        // Cage collateralTokenAdapter
        await collateralTokenAdapter.cage()
        expect(await collateralTokenAdapter.live()).to.be.eq(0)

        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.pendingRewards(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.pendingRewards(deployerAddress)).to.be.eq(0)
      })
    })

    context("when multiple users use CollateralTokenAdapter", async () => {
      it("should returns correct pending FATHOM for each user", async () => {
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

        // Bob deposit to collateralTokenAdapter, 2 blocks have passed. Hence collateralTokenAdapter should earned 200 FATHOM.
        await ibDUMMYasBob.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"))
        await collateralTokenAdapterAsBob.deposit(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )

        // The following conditions must be satisfy:
        // - collateralTokenAdapter must has 200 FATHOM as deposit trigger harvest
        // - collateralTokenAdapter.totalShare() must be 5 as Alice deposited 1 ibDUMMY + Bob deposited 4 ibDUMMY
        // - collateralTokenAdapter.accRewardPerShare() must be 200 as 0 + (2*100)/1 = 200
        // - collateralTokenAdapter.accRewardBalance() must be 200 as none of the rewards have been harvested
        // - collateralTokenAdapter.stake(alice) must be 1 ibDUMMY
        // - collateralTokenAdapter.rewardDebts(alice) must be 0
        // - collateralTokenAdapter.stake(bob) must be 4 ibDUMMY
        // - collateralTokenAdapter.rewardDebts(bob) must be 800
        // - collateralTokenAdapter.pendingRewards(alice) must be 200 FATHOM as she deposited 2 block ago
        // - collateralTokenAdapter.pendingRewards(bob) must be 0 FATHOM as he just deposited this block
        // - collateralTokenAdapter.pendingRewards(deployer) must be 0 FATHOM as he doesn't do anything
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("800"))

        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.pendingRewards(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.pendingRewards(deployerAddress)).to.be.eq(0)

        // Move 1 Block to make FairLaunch produces 100 FATHOM
        await advanceBlock()

        // The following conditions must be satisfy:
        // - collateralTokenAdapter must has 200 FATHOM as no interaction to CollateralTokenAdapter, hence FATHOM balance still the same
        // - collateralTokenAdapter.totalShare() must be 5 as Alice deposited 1 ibDUMMY + Bob deposited 4 ibDUMMY
        // - collateralTokenAdapter.accRewardPerShare() must be 200 as no interaction to CollateralTokenAdapter, hence value still the same
        // - collateralTokenAdapter.accRewardBalance() must be 200 as no interaction to CollateralTokenAdapter, hence value still the same
        // - collateralTokenAdapter.stake(alice) must be 1 ibDUMMY
        // - collateralTokenAdapter.rewardDebts(alice) must be 0
        // - collateralTokenAdapter.stake(bob) must be 4 ibDUMMY
        // - collateralTokenAdapter.rewardDebts(bob) must be 800
        // - collateralTokenAdapter.pendingRewards(alice) must be 200 FATHOM + 100 * (1/5) = 220 FATHOM
        // - collateralTokenAdapter.pendingRewards(bob) must be 100 * (4/5) = 80 FATHOM
        // - collateralTokenAdapter.pendingRewards(deployer) must be 0 FATHOM as he doesn't do anything
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("800"))

        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(ethers.utils.parseEther("220"))
        expect(await collateralTokenAdapter.pendingRewards(bobAddress)).to.be.eq(ethers.utils.parseEther("80"))
        expect(await collateralTokenAdapter.pendingRewards(deployerAddress)).to.be.eq(0)
      })
    })
  })

  describe("#cage/#uncage", async () => {
    context("when whitelist cage", async () => {
      it("should put CollateralTokenAdapter live = 0", async () => {
        await collateralTokenAdapter.cage()
        expect(await collateralTokenAdapter.live()).to.be.eq(0)
      })
    })

    context("when caller not owner role cage", async () => {
      context("when assumptions still valid", async () => {
        it("should revert", async () => {
          await expect(collateralTokenAdapterAsAlice.cage()).to.be.revertedWith("CollateralTokenAdapter/not-authorized")
        })
      })

      context("when shield's owner is changed", async () => {
        it("should put CollateralTokenAdapter live = 0", async () => {
          await shield.transferOwnership(aliceAddress)
          await collateralTokenAdapterAsAlice.cage()
          expect(await collateralTokenAdapter.live()).to.be.eq(0)
        })
      })
    })

    context("when uncage live CollateralTokenAdapter", async () => {
      it("should revert", async () => {
        await expect(collateralTokenAdapter.uncage()).to.be.revertedWith("CollateralTokenAdapter/not-caged")
      })
    })

    context("when cage and uncage", async () => {
      it("should resume operations perfectly", async () => {
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

        // Bob join the party with 4 ibDUMMY! 2 Blocks have been passed.
        // CollateralTokenAdapter should earned 200 FATHOM
        await ibDUMMYasBob.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"))
        await collateralTokenAdapterAsBob.deposit(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(0)
        expect(await fathomToken.balanceOf(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("800"))

        // Move 1 block so CollateralTokenAdapter make 100 FATHOM. However this portion
        // won't be added as CollateralTokenAdapter cage before it get harvested.
        await advanceBlock()

        // Cage CollateralTokenAdapter
        await collateralTokenAdapter.cage()
        expect(await collateralTokenAdapter.live()).to.be.eq(0)

        // Now Alice withdraw her position. Only 200 FATHOM has been harvested from FairLaunch.
        // CollateralTokenAdapter is caged. Staked collateralTokens have been emergencyWithdraw from FairLaunch.
        // The following conditions must be satisfy:
        // - Alice pending rewards must be 200 FATHOM
        // - Bob pending rewards must be 0 FATHOM as all rewards after Bob deposited hasn't been harvested.
        // - Alice should get 180 (200 - 10%) FATHOM that is harvested before cage (when Bob deposited)
        // - Alice should get 1 ibDUMMY back.
        // - Treasury account should get 20 FATHOM.
        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.pendingRewards(bobAddress)).to.be.eq(0)

        let aliceIbDUMMYbefore = await ibDUMMY.balanceOf(aliceAddress)
        await collateralTokenAdapterAsAlice.withdraw(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )
        let aliceIbDUMMYafter = await ibDUMMY.balanceOf(aliceAddress)

        expect(aliceIbDUMMYafter.sub(aliceIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(ethers.utils.parseEther("180"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("800"))
        expect(await fathomToken.balanceOf(devAddress)).to.be.eq(ethers.utils.parseEther("20"))

        await collateralTokenAdapter.uncage()
        expect(await collateralTokenAdapter.live()).to.be.eq(1)

        // Move 1 block from where CollateralTokenAdapter get uncaged.
        // Hence CollateralTokenAdapter should earned 100 FATHOM.
        // The following conditions must be satisfy:
        // - CollateralTokenAdapter must has 100 pending FATHOM
        // - Alice pending rewards must be 100 FATHOM
        // - Bob pending rewards must be 0 FATHOM
        await advanceBlock()
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("100"))
        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.pendingRewards(bobAddress)).to.be.eq(ethers.utils.parseEther("100"))

        // Now Bob withdraw his position. Only 100 FATHOM has been harvested from FairLaunch.
        // Another 100 FATHOM is pending for CollateralTokenAdapter to harvest.
        // The following conditions must be satisfy:
        // - Bob should get 180 (200 - 10%) FATHOM as 2 blocks passed.
        // - Bob pending rewards must be 0 FATHOM as all rewards are harvested.
        // - Bob should get 4 ibDUMMY back.
        // - Alice's FATHOM should remain the same.
        // - Treasury account should get 20 FATHOM.
        let bobIbDUMMYbefore = await ibDUMMY.balanceOf(bobAddress)
        await collateralTokenAdapterAsBob.withdraw(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )
        let bobIbDUMMYafter = await ibDUMMY.balanceOf(bobAddress)

        expect(bobIbDUMMYafter.sub(bobIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(ethers.utils.parseEther("180"))
        expect(await fathomToken.balanceOf(bobAddress)).to.be.eq(ethers.utils.parseEther("180"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("250")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(0)
        expect(await fathomToken.balanceOf(devAddress)).to.be.eq(ethers.utils.parseEther("40"))
      })
    })
  })

  describe("#complex", async () => {
    context("when someone sends reward token to CollateralTokenAdapter", async () => {
      it("should take them as rewards earned", async () => {
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

        // Assuming some bad luck dude transfer 150 FATHOM to CollateralTokenAdapter.
        // 1 Block get mined so CollateralTokenAdapter earned 100 FATHOM.
        // The following states are expected:
        // - Alice should has 250 pending FATHOM from collateralTokenAdapter
        // - collateralTokenAdapter should has 150 FATHOM from random dude
        // - collateralTokenAdapter should has 100 pending FATHOM from FairLaunch
        // - accRewardPerShare, accRewardBalance, and rewardDebts must be remain the same
        await fathomToken.transfer(collateralTokenAdapter.address, ethers.utils.parseEther("150"))

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("150"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(ethers.utils.parseEther("250"))
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("100"))

        // Now Alice wants to harvest the yields. 1 Block move, CollateralTokenAdapter earned another 100 FATHOM.
        // The following states are expected:
        // - Alice should get 315 (350 - 10%) FATHOM in her account
        // - Alice pending FATHOM from collateralTokenAdapter must be 0
        // - collateralTokenAdapter should has 0 FATHOM as all harvested by Alice
        // - collateralTokenAdapter should has 0 pending FATHOM as all harvested
        // - accRewardPershare, accRewardBalance, and rewardDebts must be updated correctly
        // - Treasury account should get 35 FATHOM.
        await collateralTokenAdapterAsAlice.withdraw(
          aliceAddress,
          0,
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(ethers.utils.parseEther("315"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("350")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(ethers.utils.parseEther("350"))
        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(0)
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(devAddress)).to.be.eq(ethers.utils.parseEther("35"))
      })
    })

    context("when Alice exit with emergency withdraw, but Bob wait for uncage and withdraw", async () => {
      it("should only give Bob his rewards", async () => {
        // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
        await ibDUMMYasAlice.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"))
        await collateralTokenAdapterAsAlice.deposit(
          aliceAddress,
          ethers.utils.parseEther("1"),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)

        // Bob join the party with 4 ibDUMMY! 2 Blocks have been passed.
        // CollateralTokenAdapter should earned 200 FATHOM
        await ibDUMMYasBob.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"))
        await collateralTokenAdapterAsBob.deposit(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )

        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(0)
        expect(await fathomToken.balanceOf(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("800"))

        // Move 1 block so CollateralTokenAdapter make 100 FATHOM. However this portion
        // won't be added as CollateralTokenAdapter cage before it get harvested.
        await advanceBlock()

        // Cage CollateralTokenAdapter
        await collateralTokenAdapter.cage()
        expect(await collateralTokenAdapter.live()).to.be.eq(0)

        // CollateralTokenAdapter is caged. Staked collateralTokens have been emergencyWithdraw from FairLaunch.
        // Only 200 FATHOM has been harvested from FairLaunch.
        // The following conditions must be satisfy:
        // - Alice pending rewards must be 200 FATHOM
        // - Bob pending rewards must be 0 FATHOM as all rewards after Bob deposited hasn't been harvested.
        expect(await collateralTokenAdapter.pendingRewards(aliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.pendingRewards(bobAddress)).to.be.eq(0)

        // Alice panic and decided to emergencyWithdraw.
        // The following states are expected:
        // - collateralTokenAdapte should still has 200 FATHOM as Alice dismiss her rewards
        // - Alice should not get any FATHOM as she decided to do exit via emergency withdraw instead of withdraw
        // - Alice should get 1 ibDUMMY back.
        let aliceIbDUMMYbefore = await ibDUMMY.balanceOf(aliceAddress)
        await collateralTokenAdapterAsAlice.emergencyWithdraw(aliceAddress)
        let aliceIbDUMMYafter = await ibDUMMY.balanceOf(aliceAddress)

        expect(aliceIbDUMMYafter.sub(aliceIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("1"))
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(ethers.utils.parseEther("800"))

        // Everything is fine now. So CollateralTokenAdapter get uncage.
        // 1 Block is mined. However, CollateralTokenAdapter just deposit collateralTokens back
        // to FairLaunch at this block, hence it won't earn any FATHOM.
        // The following states are expected:
        // - CollateralTokenAdapter's live must be 1
        // - Bob pending FATHOM must be 0
        await collateralTokenAdapter.uncage()
        expect(await collateralTokenAdapter.live()).to.be.eq(1)
        expect(await collateralTokenAdapter.pendingRewards(bobAddress)).to.be.eq(0)

        // Bob is a cool guy. Not panic, wait until everything becomes normal,
        // he will get his portion
        // The following states are expected:
        // - Bob should get his 4 ibDUMMY back
        // - Bob earn 90 (100 - 10%) FATHOM as block diff that Bob exit and uncage = 1 block
        // - CollateralTokenAdapter should still has 200 FATHOM that Alice dismissed
        // - Treasury account should get 10 FATHOM.
        let bobIbDUMMYbefore = await ibDUMMY.balanceOf(bobAddress)
        await collateralTokenAdapterAsBob.withdraw(
          bobAddress,
          ethers.utils.parseEther("4"),
          ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
        )
        let bobIbDUMMYafter = await ibDUMMY.balanceOf(bobAddress)

        expect(bobIbDUMMYafter.sub(bobIbDUMMYbefore)).to.be.eq(ethers.utils.parseEther("4"))
        expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
        expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
        expect(await fathomToken.balanceOf(aliceAddress)).to.be.eq(0)
        expect(await fathomToken.balanceOf(bobAddress)).to.be.eq(ethers.utils.parseEther("90"))
        expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
        expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("225")))
        expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
        expect(await collateralTokenAdapter.stake(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(aliceAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.stake(bobAddress)).to.be.eq(0)
        expect(await collateralTokenAdapter.rewardDebts(bobAddress)).to.be.eq(0)
        expect(await fathomToken.balanceOf(devAddress)).to.be.eq(ethers.utils.parseEther("10"))
      })
    })
  })
})
