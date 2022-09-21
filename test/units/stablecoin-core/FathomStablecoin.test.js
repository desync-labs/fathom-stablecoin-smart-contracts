const { ethers, upgrades, waffle } = require("hardhat");
const { expect } = require('chai');

const { AddressZero } = ethers.constants;
const WeiPerWad = hre.ethers.constants.WeiPerEther


describe("FathomStablecoin", () => {
  // Accounts
  let deployer
  let alice
  let bob

  // Account Addresses
  let deployerAddress
  let aliceAddress
  let bobAddress

  // Contracts
  let fathomStablecoin
  let fathomStablecoinAsAlice

  const loadFixtureHandler = async () => {
    const [deployer] = await ethers.getSigners()
  
    // Deploy mocked BookKeeper
    const FathomStablecoin = (await ethers.getContractFactory("FathomStablecoin", deployer))
    const fathomStablecoin = (await upgrades.deployProxy(FathomStablecoin, ["Fathom USD", "FUSD"]))
    await fathomStablecoin.deployed()
  
    return { fathomStablecoin }
  }

  beforeEach(async () => {
    ({ fathomStablecoin } = await waffle.loadFixture(loadFixtureHandler));
    [deployer, alice, bob] = await ethers.getSigners();
    [deployerAddress, aliceAddress, bobAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
    ])

    fathomStablecoinAsAlice = fathomStablecoin.connect(alice)
  })

  context("#transferFrom", () => {
    context("when alice transfer to bob", () => {
      context("when alice doesn't have enough token", () => {
        it("should be revert", async () => {
          await expect(
            fathomStablecoinAsAlice.transferFrom(aliceAddress, bobAddress, WeiPerWad.mul(100))
          ).to.be.revertedWith("FathomStablecoin/insufficient-balance")
        })
      })
      context("when alice has enough token", () => {
        context("when the caller is not the owner", async () => {
          it("should revert", async () => {
            await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), deployerAddress)
            await fathomStablecoin.mint(aliceAddress, WeiPerWad.mul(100))
            await expect(
              fathomStablecoin.transferFrom(aliceAddress, bobAddress, WeiPerWad.mul(100))
            ).to.be.revertedWith("FathomStablecoin/insufficient-allowance")
          })
          context("when Alice set allowance", () => {
            context("when allowance is not enough", () => {
              it("should revert", async () => {
                await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), deployerAddress)
                await fathomStablecoin.mint(aliceAddress, WeiPerWad.mul(100))
                await fathomStablecoinAsAlice.approve(deployerAddress, WeiPerWad)
                await expect(
                  fathomStablecoin.transferFrom(aliceAddress, bobAddress, WeiPerWad.mul(100))
                ).to.be.revertedWith("FathomStablecoin/insufficient-allowance")
              })
            })
            context("when allowance is enough", () => {
              it("should be able to call transferFrom", async () => {
                await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), deployerAddress)

                await fathomStablecoin.mint(aliceAddress, WeiPerWad.mul(100))
                await fathomStablecoinAsAlice.approve(deployerAddress, WeiPerWad.mul(100))

                const allowanceDeployerAliceBefore = await fathomStablecoin.allowance(aliceAddress, deployerAddress)
                expect(allowanceDeployerAliceBefore).to.be.equal(WeiPerWad.mul(100))
                const fathomStablecoinAliceBefore = await fathomStablecoin.balanceOf(aliceAddress)
                expect(fathomStablecoinAliceBefore).to.be.equal(WeiPerWad.mul(100))
                const fathomStablecoinBobBefore = await fathomStablecoin.balanceOf(bobAddress)
                expect(fathomStablecoinBobBefore).to.be.equal(WeiPerWad.mul(0))

                await expect(fathomStablecoin.transferFrom(aliceAddress, bobAddress, WeiPerWad.mul(10)))
                  .to.emit(fathomStablecoin, "Transfer")
                  .withArgs(aliceAddress, bobAddress, WeiPerWad.mul(10))

                const allowanceDeployerAliceAfter = await fathomStablecoin.allowance(aliceAddress, deployerAddress)
                expect(allowanceDeployerAliceAfter).to.be.equal(WeiPerWad.mul(90))
                const fathomStablecoinAliceAfter = await fathomStablecoin.balanceOf(aliceAddress)
                expect(fathomStablecoinAliceAfter).to.be.equal(WeiPerWad.mul(90))
                const fathomStablecoinBobAfter = await fathomStablecoin.balanceOf(bobAddress)
                expect(fathomStablecoinBobAfter).to.be.equal(WeiPerWad.mul(10))
              })
            })
          })
        })
        context("when the caller is the owner", () => {
          it("should be able to call transferFrom", async () => {
            await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), deployerAddress)
            await fathomStablecoin.mint(aliceAddress, WeiPerWad.mul(100))

            const fathomStablecoinAliceBefore = await fathomStablecoin.balanceOf(aliceAddress)
            expect(fathomStablecoinAliceBefore).to.be.equal(WeiPerWad.mul(100))
            const fathomStablecoinBobBefore = await fathomStablecoin.balanceOf(bobAddress)
            expect(fathomStablecoinBobBefore).to.be.equal(WeiPerWad.mul(0))

            await expect(fathomStablecoinAsAlice.transferFrom(aliceAddress, bobAddress, WeiPerWad.mul(10)))
              .to.emit(fathomStablecoin, "Transfer")
              .withArgs(aliceAddress, bobAddress, WeiPerWad.mul(10))

            const fathomStablecoinAliceAfter = await fathomStablecoin.balanceOf(aliceAddress)
            expect(fathomStablecoinAliceAfter).to.be.equal(WeiPerWad.mul(90))
            const fathomStablecoinBobAfter = await fathomStablecoin.balanceOf(bobAddress)
            expect(fathomStablecoinBobAfter).to.be.equal(WeiPerWad.mul(10))
          })
        })
      })
    })
  })

  context("#approve", () => {
    it("should be able call approve", async () => {
      const allowanceDeployerAliceBefore = await fathomStablecoin.allowance(aliceAddress, deployerAddress)
      expect(allowanceDeployerAliceBefore).to.be.equal(0)

      await expect(fathomStablecoinAsAlice.approve(deployerAddress, WeiPerWad))
        .to.emit(fathomStablecoin, "Approval")
        .withArgs(aliceAddress, deployerAddress, WeiPerWad)

      const allowanceDeployerAliceAfter = await fathomStablecoin.allowance(aliceAddress, deployerAddress)
      expect(allowanceDeployerAliceAfter).to.be.equal(WeiPerWad)
    })
  })

  context("#mint", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        await expect(fathomStablecoin.mint(aliceAddress, WeiPerWad.mul(100))).to.be.revertedWith("!minterRole")
      })
    })
    context("when the caller is the owner", async () => {
      it("should be able to call mint", async () => {
        await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), deployerAddress)
        const fathomStablecoinAliceBefore = await fathomStablecoin.balanceOf(aliceAddress)
        expect(fathomStablecoinAliceBefore).to.be.equal(0)
        const totalSupplyBefore = await fathomStablecoin.totalSupply()
        expect(totalSupplyBefore).to.be.equal(0)

        // mint 100 FUSD
        await expect(fathomStablecoin.mint(aliceAddress, WeiPerWad.mul(100)))
          .to.emit(fathomStablecoin, "Transfer")
          .withArgs(AddressZero, aliceAddress, WeiPerWad.mul(100))

        const fathomStablecoinAliceAfter = await fathomStablecoin.balanceOf(aliceAddress)
        expect(fathomStablecoinAliceAfter).to.be.equal(WeiPerWad.mul(100))
        const totalSupplyAfter = await fathomStablecoin.totalSupply()
        expect(totalSupplyAfter).to.be.equal(WeiPerWad.mul(100))
      })
    })
  })

  context("#burn", () => {
    context("when alice doesn't have enough token", () => {
      it("should be revert", async () => {
        await expect(fathomStablecoinAsAlice.burn(aliceAddress, WeiPerWad.mul(100))).to.be.revertedWith(
          "FathomStablecoin/insufficient-balance"
        )
      })
    })
    context("when alice has enough token", () => {
      context("when the caller is not the owner", async () => {
        it("should revert", async () => {
          await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), deployerAddress)
          await fathomStablecoin.mint(aliceAddress, WeiPerWad.mul(100))
          await expect(fathomStablecoin.burn(aliceAddress, WeiPerWad.mul(100))).to.be.revertedWith(
            "FathomStablecoin/insufficient-allowance"
          )
        })
        context("when Alice set allowance", () => {
          context("when allowance is not enough", () => {
            it("should revert", async () => {
              await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), deployerAddress)
              await fathomStablecoin.mint(aliceAddress, WeiPerWad.mul(100))
              await fathomStablecoinAsAlice.approve(deployerAddress, WeiPerWad)
              await expect(fathomStablecoin.burn(aliceAddress, WeiPerWad.mul(100))).to.be.revertedWith(
                "FathomStablecoin/insufficient-allowance"
              )
            })
          })
          context("when allowance is enough", () => {
            it("should be able to call burn", async () => {
              await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), deployerAddress)
              await fathomStablecoin.mint(aliceAddress, WeiPerWad.mul(100))
              await fathomStablecoinAsAlice.approve(deployerAddress, WeiPerWad.mul(100))

              const allowanceDeployerAliceBefore = await fathomStablecoin.allowance(aliceAddress, deployerAddress)
              expect(allowanceDeployerAliceBefore).to.be.equal(WeiPerWad.mul(100))
              const fathomStablecoinAliceBefore = await fathomStablecoin.balanceOf(aliceAddress)
              expect(fathomStablecoinAliceBefore).to.be.equal(WeiPerWad.mul(100))
              const totalSupplyBefore = await fathomStablecoin.totalSupply()
              expect(totalSupplyBefore).to.be.equal(WeiPerWad.mul(100))

              await expect(fathomStablecoin.burn(aliceAddress, WeiPerWad.mul(10)))
                .to.emit(fathomStablecoin, "Transfer")
                .withArgs(aliceAddress, AddressZero, WeiPerWad.mul(10))

              const allowanceDeployerAliceAfter = await fathomStablecoin.allowance(aliceAddress, deployerAddress)
              expect(allowanceDeployerAliceAfter).to.be.equal(WeiPerWad.mul(90))
              const fathomStablecoinAliceAfter = await fathomStablecoin.balanceOf(aliceAddress)
              expect(fathomStablecoinAliceAfter).to.be.equal(WeiPerWad.mul(90))
              const totalSupplyAfter = await fathomStablecoin.totalSupply()
              expect(totalSupplyAfter).to.be.equal(WeiPerWad.mul(90))
            })
          })
        })
      })
      context("when the caller is the owner", () => {
        it("should be able to call burn", async () => {
          await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), deployerAddress)
          await fathomStablecoin.mint(aliceAddress, WeiPerWad.mul(100))

          const fathomStablecoinAliceBefore = await fathomStablecoin.balanceOf(aliceAddress)
          expect(fathomStablecoinAliceBefore).to.be.equal(WeiPerWad.mul(100))
          const totalSupplyBefore = await fathomStablecoin.totalSupply()
          expect(totalSupplyBefore).to.be.equal(WeiPerWad.mul(100))

          await expect(fathomStablecoinAsAlice.burn(aliceAddress, WeiPerWad.mul(10)))
            .to.emit(fathomStablecoin, "Transfer")
            .withArgs(aliceAddress, AddressZero, WeiPerWad.mul(10))

          const fathomStablecoinAliceAfter = await fathomStablecoin.balanceOf(aliceAddress)
          expect(fathomStablecoinAliceAfter).to.be.equal(WeiPerWad.mul(90))
          const totalSupplyAfter = await fathomStablecoin.totalSupply()
          expect(totalSupplyAfter).to.be.equal(WeiPerWad.mul(90))
        })
      })
    })
  })
})
