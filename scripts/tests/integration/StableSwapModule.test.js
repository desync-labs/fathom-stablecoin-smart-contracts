const chai = require('chai');
const { BigNumber, ethers } = require("ethers");
const { MaxUint256 } = require("@ethersproject/constants");
const TimeHelpers = require("../helper/time");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { DeployerAddress } = require("../helper/address");
const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");
const { WeiPerWad } = require("../helper/unit");
const { expect } = chai

const TO_DEPOSIT = ethers.utils.parseEther("10000000")
const TO_MINT= ethers.utils.parseEther("20000000")
const TWENTY_PERCENT_OF_TO_DEPOSIT = ethers.utils.parseEther("4000000") //20Million * 20% = 400k
const THIRTY_PERCENT_OF_TO_DEPOSIT = ethers.utils.parseEther("6000000")
const ONE_PERCENT_OF_TOTAL_DEPOSIT = ethers.utils.parseEther("200000")
const FOURTY_PERCENT_OF_TO_DEPOSIT= ethers.utils.parseEther("8000000")
const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const stableswapMultipleSwapsMock = await artifacts.initializeInterfaceAt("StableswapMultipleSwapsMock", "StableswapMultipleSwapsMock");

    const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
    

    const usdtAddr = await stableSwapModule.token()
    const USDT = await artifacts.initializeInterfaceAt("ERC20Mintable", usdtAddr);

    await USDT.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
    await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
    
    await USDT.mint(DeployerAddress, TO_DEPOSIT, { gasLimit: 1000000 })
    await fathomStablecoin.mint(DeployerAddress, TO_DEPOSIT, { gasLimit: 1000000 })

    await stableSwapModule.depositToken(USDT.address,TO_DEPOSIT,{ gasLimit: 1000000 })
    await stableSwapModule.depositToken(fathomStablecoin.address,TO_DEPOSIT,{ gasLimit: 1000000 })

    await USDT.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000})
    await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
    await USDT.mint(DeployerAddress, TO_MINT, { gasLimit: 1000000 })
    await fathomStablecoin.mint(DeployerAddress, TO_MINT, { gasLimit: 1000000 })

    return {
        USDT,
        stableSwapModule,
        fathomStablecoin,
        stableswapMultipleSwapsMock
    }
}

describe("StableSwapModule", () => {
    // Contracts
    let USDT
    let stableSwapModule
    let fathomStablecoin

    let stableswapMultipleSwapsMock

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            USDT,
            stableSwapModule,
            fathomStablecoin,
            stableswapMultipleSwapsMock
        } = await loadFixture(setup));
    })

    describe("#swapTokenToStablecoin", async () => {
        context("swap USDT to FXD", async () => {
            it("should success", async () => {
                const beforeBalanceOfStablecoin = await fathomStablecoin.balanceOf(DeployerAddress)
                const beforeBalanceOfUSDT = await USDT.balanceOf(DeployerAddress)

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ethers.utils.parseEther("500000"), { gasLimit: 1000000 })
                const afterBalanceOfStablecoin = await fathomStablecoin.balanceOf(DeployerAddress)
                const afterBalanceOfUSDT = await USDT.balanceOf(DeployerAddress)
                
                // 500000 -> from swap, -ve 500 -> from fee. Total balance = 500000-500 = 499500
                expect(afterBalanceOfStablecoin.sub(beforeBalanceOfStablecoin)).to.be.equal(ethers.utils.parseEther("499500"))
                //-ve 500000 -> from swap. Total Balance = 500000
                expect(beforeBalanceOfUSDT.sub(afterBalanceOfUSDT)).to.be.equal(ethers.utils.parseEther("500000"))
            })
        })

        context("swap USDT to FXD", async () => {
            it("should success", async () => {
                const beforeBalanceOfStablecoin = await fathomStablecoin.balanceOf(DeployerAddress)
                const beforeBalanceOfUSDT = await USDT.balanceOf(DeployerAddress)
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ethers.utils.parseEther("1000000"), { gasLimit: 1000000 })
                const afterBalanceOfStablecoin = await fathomStablecoin.balanceOf(DeployerAddress)
                const afterBalanceOfUSDT = await USDT.balanceOf(DeployerAddress)
                
                // 1000000 -> from swap, -ve 500-> from fee. Total balance = 1000000 - 1000 = 999000
                expect(afterBalanceOfStablecoin.sub(beforeBalanceOfStablecoin)).to.be.equal(ethers.utils.parseEther("999000"))
                // -ve 1000000 -> from swap. Total Balance = 1000000
                expect(beforeBalanceOfUSDT.sub(afterBalanceOfUSDT)).to.be.equal(ethers.utils.parseEther("1000000"))
            })
        })
    })

    describe("#swapStablecoinToToken", async () => {
        context("collateral not enough", async () => {
            it("should SWAP", async () => {
                const beforeBalanceOfStablecoin = await fathomStablecoin.balanceOf(DeployerAddress)
                const beforeBalanceOfUSDT = await USDT.balanceOf(DeployerAddress)

                await stableSwapModule.swapStablecoinToToken(DeployerAddress,ethers.utils.parseEther("1000000"), { gasLimit: 1000000 })
                const afterBalanceOfStablecoin = await fathomStablecoin.balanceOf(DeployerAddress)
                const afterBalanceOfUSDT = await USDT.balanceOf(DeployerAddress)
                expect(beforeBalanceOfStablecoin.sub(afterBalanceOfStablecoin)).to.be.equal(ethers.utils.parseEther("1000000"))
                // 1000000 -> from swap, -ve 500-> from fee. Total balance = 1000000 - 1000 = 999000
                expect(afterBalanceOfUSDT.sub(beforeBalanceOfUSDT)).to.be.equal(ethers.utils.parseEther("999000"))
            })
        })

        context("swap FXD to USDT", async () => {
            it("should success", async () => {
                // Mint 1000 USDT to deployer
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })
                // Swap 998 FXD to USDT
                await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
                await stableSwapModule.swapStablecoinToToken(DeployerAddress,ethers.utils.parseEther("998"), { gasLimit: 1000000 })
                // first swap FXDFee = 1000 * 0.001 = 1 FXD
                // second swap TokenFee = 998 * 0.001 = 0.998 Token
                await stableSwapModule.withdrawFees(accounts[2]);
                const feeFromSwap = await fathomStablecoin.balanceOf(accounts[2])
                expect(feeFromSwap).to.be.equal(ethers.utils.parseEther("1"))
                const USDTfeeFromSwap = await USDT.balanceOf(accounts[2])
                expect(USDTfeeFromSwap).to.be.equal(ethers.utils.parseEther("0.998"))
            })
        })
    })

    describe("#addToWhitelist", async () => {
        context("add to whitelist and check it should swap", async () => {
            it("should swapStablecoinToToken", async () => {
                const whitelistAccount = accounts[2]
                await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { from: whitelistAccount,gasLimit: 1000000})
                await fathomStablecoin.mint(whitelistAccount, TO_MINT, { gasLimit: 1000000 })
                await stableSwapModule.addToWhitelist(whitelistAccount)
                const beforeBalanceOfStablecoin = await fathomStablecoin.balanceOf(whitelistAccount)
                const beforeBalanceOfUSDT = await USDT.balanceOf(whitelistAccount)
                
                await stableSwapModule.swapStablecoinToToken(whitelistAccount,ethers.utils.parseEther("1000000"), {from: whitelistAccount, gasLimit: 1000000 })
                const afterBalanceOfStablecoin = await fathomStablecoin.balanceOf(whitelistAccount)
                const afterBalanceOfUSDT = await USDT.balanceOf(whitelistAccount)
                expect(beforeBalanceOfStablecoin.sub(afterBalanceOfStablecoin)).to.be.equal(ethers.utils.parseEther("1000000"))
                // 1000000 -> from swap, -ve 500-> from fee. Total balance = 1000000 - 1000 = 999000
                expect(afterBalanceOfUSDT.sub(beforeBalanceOfUSDT)).to.be.equal(ethers.utils.parseEther("999000"))
            })
            
        })

        context("add to whitelist and check it should swap", async () => {
            it("should swapTokenToStablecoin", async () => {
                const whitelistAccount = accounts[2]
                await USDT.approve(stableSwapModule.address, MaxUint256, { from: whitelistAccount,gasLimit: 1000000})
                await USDT.mint(whitelistAccount, TO_MINT, { gasLimit: 1000000 })
                await fathomStablecoin.mint(whitelistAccount, TO_MINT, { gasLimit: 1000000 })
                await stableSwapModule.addToWhitelist(whitelistAccount)
                await stableSwapModule.swapTokenToStablecoin(whitelistAccount,ethers.utils.parseEther("1000000"), { from: whitelistAccount,gasLimit: 1000000 })
            })
            
        })
    })

    describe("#removeFromWhitelist", async () => {
        context("add to whitelist and check it should swap and again remove from whitelist and check for revert", async () => {
            it("should swapStablecoinToToken and revert", async () => {
                const whitelistAccount = accounts[2]
                await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { from: whitelistAccount,gasLimit: 1000000})
                await fathomStablecoin.mint(whitelistAccount, TO_MINT, { gasLimit: 1000000 })
                await stableSwapModule.addToWhitelist(whitelistAccount)
                await stableSwapModule.swapStablecoinToToken(whitelistAccount,ethers.utils.parseEther("1000000"), {from: whitelistAccount, gasLimit: 1000000 })
                await stableSwapModule.removeFromWhitelist(whitelistAccount)
                await expect(stableSwapModule.swapStablecoinToToken(whitelistAccount,ethers.utils.parseEther("1000000"), {from: whitelistAccount, gasLimit: 1000000 })).to.be.revertedWith("user-not-whitelisted")
            })
            
        })

        context("add to whitelist and check it should swap and again remove from whitelist and check for revert", async () => {
            it("should swapTokenToStablecoin and revert", async () => {
                const whitelistAccount = accounts[2]
                await USDT.approve(stableSwapModule.address, MaxUint256, { from: whitelistAccount,gasLimit: 1000000})
                await USDT.mint(whitelistAccount, TO_MINT, { gasLimit: 1000000 })
                await fathomStablecoin.mint(whitelistAccount, TO_MINT, { gasLimit: 1000000 })
                await stableSwapModule.addToWhitelist(whitelistAccount)
                await stableSwapModule.swapTokenToStablecoin(whitelistAccount,ethers.utils.parseEther("1000000"), { from: whitelistAccount,gasLimit: 1000000 })
                await stableSwapModule.removeFromWhitelist(whitelistAccount)
                await expect(stableSwapModule.swapTokenToStablecoin(whitelistAccount,ethers.utils.parseEther("1000000"), {from: whitelistAccount, gasLimit: 1000000 })).to.be.revertedWith("user-not-whitelisted")
            })
            
        })
    })

    describe("#dailyLimitCheck", async () => {
        context("check for daily limit", async() => {
            it("Should swap tokens and revert when dailyswap limit is reached", async() => {
                //first swap which takes all the allowance
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                console.log("Swapping twenty times to check for DailyLimit Cross")
                for(let i =0;i < 10;i++){
                    console.log("Swapping Token to Stablecoin - No...........",i+1)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for(let i =0;i < 10;i++){
                    console.log("Swapping Stablecion to Token - No...........",i+1)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })    
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }
                //revert because it exceed allowance
                
                await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress,ethers.utils.parseEther("100"), { gasLimit: 1000000 })
                ).to.be.revertedWith("_udpateAndCheckDailyLimit/daily-limit-exceeded")
                await TimeHelpers.increase(1)
                await expect(stableSwapModule.swapStablecoinToToken(DeployerAddress,ethers.utils.parseEther("100"), { gasLimit: 1000000 })
                ).to.be.revertedWith("_udpateAndCheckDailyLimit/daily-limit-exceeded")
                await TimeHelpers.increase(1)
                const ONE_DAY = 86400
                await TimeHelpers.increase(ONE_DAY+20)
                //again swap after increasing timestamp
                //should succeed
                await stableSwapModule.swapStablecoinToToken(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })
            })
        })

        context("check for daily limit - depositToken", async() => {
            it("Should update dailyLimit on depositing more token", async() => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })    
                await stableSwapModule.depositToken(USDT.address,TO_DEPOSIT,{ gasLimit: 1000000 })
                await stableSwapModule.depositToken(fathomStablecoin.address,TO_DEPOSIT,{ gasLimit: 1000000 })
                //Why GreaterThanOrEqual? Because there is one swap already done which incurs fee so total pool has increased
                const remainingDailySwapAmount = await stableSwapModule.remainingDailySwapAmount() 
                expect(remainingDailySwapAmount).to.be.gte(FOURTY_PERCENT_OF_TO_DEPOSIT);
            })
        })

        context("check for daily limit - setDailySwapLimitNumerator", async() => {
            it("Should update dailyLimit on depositing more token", async() => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })    
                await stableSwapModule.setDailySwapLimitNumerator(3000,{gasLimit: 8000000})
                //Why GreaterThanOrEqual? Because there is one swap already done which incurs fee so total pool has increased
                const remainingDailySwapAmount = await stableSwapModule.remainingDailySwapAmount() 
                expect(remainingDailySwapAmount).to.be.gte(THIRTY_PERCENT_OF_TO_DEPOSIT);
            })
        })
    })

    describe("#singleSwapLimitCheck", async () => {
        context("check for daily limit", async() => {
            it("Should revert when SingleSwap Limit is reached", async() => {
                //first swap which takes all the allowance
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                await expect(stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT.add(1), { gasLimit: 1000000 })).to.be.revertedWith('_checkSingleSwapLimit/single-swap-exceeds-limit')
            })
        })
    })

    describe("#singleBlockLimitCheck", async () => {
        context("check for daily limit", async() => {
            it("Should revert when SingleSwap Limit is reached", async() => {
                //first swap which takes all the allowance
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })

                await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })).to.be.revertedWith('one-block-swap-limit-exceeded')
            })
        })
    })

    describe("#stableSwapEmergencyWithdraw", async () => {
        context("emergency withdraw", async() => {
            it("Should emergency withdraw when paused", async() =>{
                await expect(stableSwapModule.emergencyWithdraw(accounts[5])).to.be.reverted;
                await stableSwapModule.pause();
                await stableSwapModule.emergencyWithdraw(accounts[5]);
                const balanceOfStablecoin = await fathomStablecoin.balanceOf(accounts[5])
                const balanceOfToken = await USDT.balanceOf(accounts[5])
                expect(balanceOfStablecoin).to.be.equal(ethers.utils.parseEther("10000000"))
                expect(balanceOfToken).to.be.equal(ethers.utils.parseEther("10000000"))
            })
        })
    })

    describe("#StableswapMultipleSwapsMock", async () => {
        context("twoStablecoinToTokenSwapAtSameBlock- swap tokens in same block", async () => {
            it("should revert if we swap tokens in same block", async () => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})  
                await fathomStablecoin.approve(stableswapMultipleSwapsMock.address,MaxUint256,{gasLimit:8000000})
                await expect(
                    stableswapMultipleSwapsMock.twoStablecoinToTokenSwapAtSameBlock(stableSwapModule.address,fathomStablecoin.address,ONE_PERCENT_OF_TOTAL_DEPOSIT,{gasLimit:8000000})
                ).to.be.revertedWith("no error message bubbled up - for second swap") //TODO: Why is error not bubbling up?
            })
         })

         context("twoTokenToStablecoinSwapAtSameBlock- swap tokens in same block",async () => {
            it("should revert if we swap tokens in same block", async () => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})  
                await USDT.approve(stableswapMultipleSwapsMock.address,MaxUint256,{gasLimit:8000000})
                await expect(
                    stableswapMultipleSwapsMock.twoTokenToStablecoinSwapAtSameBlock(stableSwapModule.address,USDT.address,ONE_PERCENT_OF_TOTAL_DEPOSIT,{gasLimit:8000000})
                ).to.be.revertedWith("no error message bubbled up - for second swap") //TODO: Why is error not bubbling up?
            })
         })
    })

    describe("#stableswapNotWhitelistedUserSwaps", async () => {
        context("not whitelisted-swapTokenToStablecoin", () => {
            it("should revert -  fail if the decentralized state is not activated and sender is not whitelisted", async () => {
              await expect(
                stableSwapModule.swapTokenToStablecoin(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT,{from: accounts[2]})
              ).to.be.revertedWith("user-not-whitelisted")
            })
          })
          context("not whitelisted-swapStablecoinToToken", () => {
            it("should revert -  fail if the decentralized state is not activated and sender is not whitelisted", async () => {
              await expect(
                stableSwapModule.swapStablecoinToToken(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT, {from: accounts[2]})
              ).to.be.revertedWith("user-not-whitelisted")
            })
        })
    })

    
})
