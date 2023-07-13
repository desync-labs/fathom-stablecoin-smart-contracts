const chai = require('chai');
const { BigNumber, ethers } = require("ethers");
const { MaxUint256 } = require("@ethersproject/constants");
const TimeHelpers = require("../helper/time");
const ONE_BIG_NUMBER = BigNumber.from(1)

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { DeployerAddress } = require("../helper/address");
const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");
const { WeiPerWad } = require("../helper/unit");
const { expect } = chai
const WeiPerSixDecimals = BigNumber.from(`1${"0".repeat(6)}`)

const TO_DEPOSIT = ethers.utils.parseEther("10000000")
const TO_MINT= ethers.utils.parseEther("20000000")
const TO_DEPOSIT_USD = WeiPerSixDecimals.mul(10000000)
const TO_MINT_USD = WeiPerSixDecimals.mul(20000000)


const TWENTY_PERCENT_OF_TO_DEPOSIT = ethers.utils.parseEther("4000000") //20Million * 20% = 400k
const THIRTY_PERCENT_OF_TO_DEPOSIT = ethers.utils.parseEther("6000000")
const ONE_PERCENT_OF_TOTAL_DEPOSIT = ethers.utils.parseEther("200000")
const FOURTY_PERCENT_OF_TO_DEPOSIT= ethers.utils.parseEther("8000000")

const ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS = WeiPerSixDecimals.mul(200000)
const THIRTY_PERCENT_OF_TO_DEPOSIT_SIX_DECIMALS = WeiPerSixDecimals.mul(6000000)
const FOURTY_PERCENT_OF_TO_DEPOSIT_SIX_DECIMALS = WeiPerSixDecimals.mul(8000000)

//why this divider:
//right now fee is 0.001
//so for ONE_PERCENT_OF_TOTAL_DEPOSIT = 200000, fee = 200
//so, totalValueDeposited will be decreased by 200 each time we swap to account for fees
//ie. for first swap it will reduce from 200,000,000 to 199,999,800
//for second swap it will reduce from 199,999,800 to 199,999,600
//so, taking One percent of total Deposit = 199,999,800 * 0.01 = 199998 after first swap
//therfore, we divide by 100000 (onehundred thousand)in each swap because we want to take 1% of total deposit
//ie, 200000 * 1e18 - 200000 * 1e18 / 100000 =  =~ 199998 ether
//but dividing by 1000(thousand) so that we account for previous swaps fees
const DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT = BigNumber.from("1000")

const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const stableswapMultipleSwapsMock = await artifacts.initializeInterfaceAt("StableswapMultipleSwapsMock", "StableswapMultipleSwapsMock");

    const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
    const stableSwapModuleWrapper = await getProxy(proxyFactory, "StableSwapModuleWrapper");
    

    const usdtAddr = await stableSwapModule.token()
    const USDT = await artifacts.initializeInterfaceAt("ERC20Mintable", usdtAddr);

    await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000 })
    await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000 })
    
    await USDT.mint(DeployerAddress, TO_DEPOSIT, { gasLimit: 1000000 })
    await fathomStablecoin.mint(DeployerAddress, TO_DEPOSIT, { gasLimit: 1000000 })

    await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT,{ gasLimit: 1000000 })

    await USDT.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000})
    await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
    await USDT.mint(DeployerAddress, TO_MINT, { gasLimit: 1000000 })
    await fathomStablecoin.mint(DeployerAddress, TO_MINT, { gasLimit: 1000000 })

    return {
        USDT,
        stableSwapModule,
        fathomStablecoin,
        stableswapMultipleSwapsMock,
        stableSwapModuleWrapper
    }
}

describe("StableSwapModule", () => {
    // Contracts
    let USDT
    let stableSwapModule
    let fathomStablecoin
    let stableSwapModuleWrapper
    let stableswapMultipleSwapsMock

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            USDT,
            stableSwapModule,
            fathomStablecoin,
            stableswapMultipleSwapsMock,
            stableSwapModuleWrapper
        } = await loadFixture(setup));
    })

    describe("#swapTokenToStablecoin", async () => {
        context("swap USDT to FXD", async () => {
            it("should success", async () => {
                const beforeBalanceOfStablecoin = await fathomStablecoin.balanceOf(DeployerAddress)
                const beforeBalanceOfUSDT = await USDT.balanceOf(DeployerAddress)
                const FIVE_HUNDRED_THOUSAND_SIX_DECIMALS = WeiPerSixDecimals.mul(500000)
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress,FIVE_HUNDRED_THOUSAND_SIX_DECIMALS, { gasLimit: 1000000 })
                const afterBalanceOfStablecoin = await fathomStablecoin.balanceOf(DeployerAddress)
                const afterBalanceOfUSDT = await USDT.balanceOf(DeployerAddress)
                
                // 500000 -> from swap, -ve 500 -> from fee. Total balance = 500000-500 = 499500
                expect(afterBalanceOfStablecoin.sub(beforeBalanceOfStablecoin)).to.be.equal(ethers.utils.parseEther("499500"))
                //-ve 500000 -> from swap. Total Balance = 500000
                expect(beforeBalanceOfUSDT.sub(afterBalanceOfUSDT)).to.be.equal(FIVE_HUNDRED_THOUSAND_SIX_DECIMALS)
            })
        })

        context("swap USDT to FXD", async () => {
            it("should success", async () => {
                const beforeBalanceOfStablecoin = await fathomStablecoin.balanceOf(DeployerAddress)
                const beforeBalanceOfUSDT = await USDT.balanceOf(DeployerAddress)
                const ONE_MILLION_SIX_DECIMALS = WeiPerSixDecimals.mul(1000000)

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_MILLION_SIX_DECIMALS, { gasLimit: 1000000 })
                const afterBalanceOfStablecoin = await fathomStablecoin.balanceOf(DeployerAddress)
                const afterBalanceOfUSDT = await USDT.balanceOf(DeployerAddress)
                
                // 1000000 -> from swap, -ve 500-> from fee. Total balance = 1000000 - 1000 = 999000
                expect(afterBalanceOfStablecoin.sub(beforeBalanceOfStablecoin)).to.be.equal(ethers.utils.parseEther("999000"))
                // -ve 1000000 -> from swap. Total Balance = 1000000
                expect(beforeBalanceOfUSDT.sub(afterBalanceOfUSDT)).to.be.equal(ONE_MILLION_SIX_DECIMALS)
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
                expect(afterBalanceOfUSDT.sub(beforeBalanceOfUSDT)).to.be.equal(WeiPerSixDecimals.mul(999000))
            })
        })

        context("swap FXD to USDT", async () => {
            it("should success", async () => {
                // Mint 1000 USDT to deployer
                
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress, WeiPerSixDecimals.mul(1000), { gasLimit: 1000000 })
                // Swap 998 FXD to USDT
                await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
                await stableSwapModule.swapStablecoinToToken(DeployerAddress,ethers.utils.parseEther("998"), { gasLimit: 1000000 })
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
                expect(afterBalanceOfUSDT.sub(beforeBalanceOfUSDT)).to.be.equal(WeiPerSixDecimals.mul(999000))
            })
            
        })

        context("add to whitelist and check it should swap", async () => {
            it("should swapTokenToStablecoin", async () => {
                const whitelistAccount = accounts[2]
                await USDT.approve(stableSwapModule.address, MaxUint256, { from: whitelistAccount,gasLimit: 1000000})
                await USDT.mint(whitelistAccount, TO_MINT, { gasLimit: 1000000 })
                await fathomStablecoin.mint(whitelistAccount, TO_MINT, { gasLimit: 1000000 })
                await stableSwapModule.addToWhitelist(whitelistAccount)
                await stableSwapModule.swapTokenToStablecoin(whitelistAccount,WeiPerSixDecimals.mul(1000000), { from: whitelistAccount,gasLimit: 1000000 })
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
                await stableSwapModule.swapTokenToStablecoin(whitelistAccount,WeiPerSixDecimals.mul(1000000), { from: whitelistAccount,gasLimit: 1000000 })
                await stableSwapModule.removeFromWhitelist(whitelistAccount)
                await expect(stableSwapModule.swapTokenToStablecoin(whitelistAccount,WeiPerSixDecimals.mul(1000000), {from: whitelistAccount, gasLimit: 1000000 })).to.be.revertedWith("user-not-whitelisted")
            })
            
        })
    })

    describe("#dailyLimitCheck", async () => {
        context("check for daily limit", async() => {
            it("Should swap tokens and revert when dailyswap limit is reached", async() => {
                //first swap which takes all the allowance
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                console.log("Swapping twenty times to check for DailyLimit Cross")
                let numberOfSwaps = 0;
                for(let i =0;i < 10;i++){
                    console.log("Swapping Token to Stablecoin - No...........",i+1)
                    //div by 1000 so that single swap limit is not reached
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                    numberOfSwaps++
                }

                for(let i =0;i < 10;i++){
                    console.log("Swapping Stablecion to Token - No...........",i+1)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })    
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                    numberOfSwaps++
                }
                //revert because it exceed allowance
                
                await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })
                ).to.be.revertedWith("_updateAndCheckDailyLimit/daily-limit-exceeded")
                await TimeHelpers.increase(1)
                await expect(stableSwapModule.swapStablecoinToToken(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })
                ).to.be.revertedWith("_updateAndCheckDailyLimit/daily-limit-exceeded")
                await TimeHelpers.increase(1)
                const ONE_DAY = 86400
                await TimeHelpers.increase(ONE_DAY+20)
                //again swap after increasing timestamp
                //should succeed
                await stableSwapModule.swapStablecoinToToken(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT), { gasLimit: 1000000 })
                await stableSwapModule.initializeFeesAfterUpgrade({gasLimit: 8000000})
                await expect(stableSwapModule.initializeFeesAfterUpgrade({gasLimit: 8000000})).to.be.revertedWith('StableSwapModule/already-initialized')
            })
        })

        context("check for daily limit - depositToken", async() => {
            it("Should update dailyLimit on depositing more token", async() => {
                await TimeHelpers.increase(1)
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:800000})
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })    
                await TimeHelpers.increase(1)
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT,{ gasLimit: 1000000 })
                //Why GreaterThanOrEqual? Because there is one swap already done which incurs fee so total pool has increased
                await TimeHelpers.increase(1)
                const remainingDailySwapAmount = await stableSwapModule.remainingDailySwapAmount() 
                expect(remainingDailySwapAmount).to.be.gte(FOURTY_PERCENT_OF_TO_DEPOSIT.sub(FOURTY_PERCENT_OF_TO_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)));
            })
        })

        context("check for daily limit - setDailySwapLimitNumerator", async() => {
            it("Should update dailyLimit on depositing more token", async() => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT,{ gasLimit: 1000000 })
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })    
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
        context("check for block limit", async() => {
            it("Should revert when number of swaps per block limit is reached", async() => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })
                //this reverts because one user can swap only once in two blocks and we have already done one swap
                await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })).to.be.revertedWith('_updateAndCheckNumberOfSwapsInBlocksPerLimit/swap-limit-exceeded')
            })
        })
    })

    describe("#checkForDifferentBlockLimitsSet", async () => {
        context("check for block limit", async() => {
            it("Should revert when SingleSwap Limit is reached", async() => {
                //first swap which takes all the allowance
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                const newNumberOfSwapsLimitPerUser = 2
                const newBlocksPerLimit = 3
                await stableSwapModule.setNumberOfSwapsLimitPerUser(newNumberOfSwapsLimitPerUser, { gasLimit: 1000000 })
                await stableSwapModule.setBlocksPerLimit(newBlocksPerLimit, { gasLimit: 1000000 })
                
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })
                
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })
                
                await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })).to.be.revertedWith('_updateAndCheckNumberOfSwapsInBlocksPerLimit/swap-limit-exceeded')
            })
        })
        context("check for block limit", async() => {
            it("Should be successful and not reach limit - setting 3 swaps per 3 blocks", async() => {
                //first swap which takes all the allowance
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                const newNumberOfSwapsLimitPerUser = 3
                const newBlocksPerLimit = 3
                await stableSwapModule.setNumberOfSwapsLimitPerUser(newNumberOfSwapsLimitPerUser, { gasLimit: 1000000 })
                await stableSwapModule.setBlocksPerLimit(newBlocksPerLimit, { gasLimit: 1000000 })
                
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })
                
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })
                
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                        ,ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })
                
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })
            })
        })
        context("check for block limit", async() => {
            it("Should revert for extra swap in the limit and then again be sucessful after enough block passes", async() => {
                //first swap which takes all the allowance
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                const newNumberOfSwapsLimitPerUser = 3
                const newBlocksPerLimit = 10
                const blockNumbersToReachForNextSwap = 12
                await stableSwapModule.setNumberOfSwapsLimitPerUser(newNumberOfSwapsLimitPerUser, { gasLimit: 1000000 })
                await stableSwapModule.setBlocksPerLimit(newBlocksPerLimit, { gasLimit: 1000000 })
                
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                        ,ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })
                //This should fail because its 4th swap within 500 block window
                await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })).to.be.revertedWith('_updateAndCheckNumberOfSwapsInBlocksPerLimit/swap-limit-exceeded')
                for(let i = 0; i<blockNumbersToReachForNextSwap; i++){
                    await TimeHelpers.advanceBlock()
                }

                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT)), { gasLimit: 1000000 })
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
                expect(balanceOfToken).to.be.equal(WeiPerSixDecimals.mul(10000000))
            })
        })
    })

    describe("#StableswapMultipleSwapsMock", async () => {
        context("twoStablecoinToTokenSwapAtSameBlock- swap tokens in same block", async () => {
            it("should revert if we swap tokens in same block", async () => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})  
                await fathomStablecoin.approve(stableswapMultipleSwapsMock.address,MaxUint256,{gasLimit:8000000})
                await expect(
                    stableswapMultipleSwapsMock.twoStablecoinToTokenSwapAtSameBlock(stableSwapModule.address,fathomStablecoin.address,ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(5000)),{gasLimit:8000000})
                ).to.be.revertedWith("_updateAndCheckNumberOfSwapsInBlocksPerLimit/swap-limit-exceeded")
            })
         })

         context("twoTokenToStablecoinSwapAtSameBlock- swap tokens in same block",async () => {
            it("should revert if we swap tokens in same block", async () => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})  
                await USDT.approve(stableswapMultipleSwapsMock.address,MaxUint256,{gasLimit:8000000})
                await expect(
                    stableswapMultipleSwapsMock.twoTokenToStablecoinSwapAtSameBlock(stableSwapModule.address,USDT.address,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.div(5000)),{gasLimit:8000000})
                ).to.be.revertedWith("_updateAndCheckNumberOfSwapsInBlocksPerLimit/swap-limit-exceeded") 
            })
         })
        context("twoStablecoinToTokenSwapAtSameBlock- swap tokens in same block", async () => {
            it("Should be successful for two swaps in same block", async () => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})  
                const newNumberOfSwapsLimitPerUser = 3
                const newBlocksPerLimit = 1
                await stableSwapModule.setNumberOfSwapsLimitPerUser(newNumberOfSwapsLimitPerUser, { gasLimit: 1000000 })
                await stableSwapModule.setBlocksPerLimit(newBlocksPerLimit, { gasLimit: 1000000 })

                await fathomStablecoin.approve(stableswapMultipleSwapsMock.address,MaxUint256,{gasLimit:8000000})
                await stableswapMultipleSwapsMock.twoStablecoinToTokenSwapAtSameBlock(stableSwapModule.address,fathomStablecoin.address,ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(4000)),{gasLimit:8000000});
            })
        })

        context("twoTokenToStablecoinSwapAtSameBlock- swap tokens in same block", async () => {
            it("Should be successful for two swaps in same block", async () => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})  
                const newNumberOfSwapsLimitPerUser = 3
                const newBlocksPerLimit = 1
                await stableSwapModule.setNumberOfSwapsLimitPerUser(newNumberOfSwapsLimitPerUser, { gasLimit: 1000000 })
                await stableSwapModule.setBlocksPerLimit(newBlocksPerLimit, { gasLimit: 1000000 })

                await USDT.approve(stableswapMultipleSwapsMock.address,MaxUint256,{gasLimit:8000000})
                await stableswapMultipleSwapsMock.twoTokenToStablecoinSwapAtSameBlock(stableSwapModule.address,USDT.address,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.div(4000)),{gasLimit:8000000});
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

    describe("#getIsUsersWhitelisted", async () => {
        context("is whitelisted should be true", () => {
            it("should return true", async () => {
                const isUserWhitelisted = await stableSwapModule.isUserWhitelisted(DeployerAddress)
                expect(isUserWhitelisted).to.be.equal(true)
            })
          })

        context("is whitelisted should be true", () => {
        it("should return false", async () => {
            const isUserWhitelisted = await stableSwapModule.isUserWhitelisted(accounts[2])
            expect(isUserWhitelisted).to.be.equal(false)
            })
        })
    })

    describe("#totalValueDeposited", async() => {
        context("update total value deposited after upgrade", async() => {
            it("totalValueDeposited: should be same before and after upgrade", async() => {
                const totalValueDepositedBeforeUpdate = await stableSwapModule.totalValueDeposited();
                await stableSwapModule.udpateTotalValueDeposited()
                const totalValueDepositedAfterUpdate = await stableSwapModule.totalValueDeposited();
                expect(totalValueDepositedAfterUpdate).to.be.equal(totalValueDepositedBeforeUpdate)
            })
        })
    })

    describe('#unitTests',async() => {
        context("exceed single swap limit", () => {
            it("should revert after setting decentralized state - single swap limit - swapStablecoinToToken", async () => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                await expect(stableSwapModule.swapStablecoinToToken(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT.add(1), { gasLimit: 1000000 })).to.be.revertedWith('_checkSingleSwapLimit/single-swap-exceeds-limit')
            })
          })

          context("exceed single swap limit", () => {
            it("should revert after setting decentralized state - single swap limit - swapTokenToStablecoin", async () => {
                await stableSwapModule.setDecentralizedStatesStatus(true,{gasLimit:8000000})
                await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    ,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.add(1), { gasLimit: 1000000 })).to.be.revertedWith('_checkSingleSwapLimit/single-swap-exceeds-limit')
            })
          })
    })

    
})
