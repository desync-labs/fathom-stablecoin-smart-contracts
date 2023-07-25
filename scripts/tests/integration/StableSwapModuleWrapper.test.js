const chai = require('chai');
const { BigNumber, ethers } = require("ethers");
const { MaxUint256 } = require("@ethersproject/constants");
const TimeHelpers = require("../helper/time");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { DeployerAddress, AliceAddress } = require("../helper/address");
const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");
const { WeiPerWad } = require("../helper/unit");
const { expect } = chai

const WeiPerSixDecimals = BigNumber.from(`1${"0".repeat(6)}`)

const TO_DEPOSIT_USD = WeiPerSixDecimals.mul(10000000)
const TO_MINT_USD = WeiPerSixDecimals.mul(20000000)

const TO_DEPOSIT = ethers.utils.parseEther("10000000")
const TO_MINT = ethers.utils.parseEther("20000000")

const ONE_PERCENT_OF_TOTAL_DEPOSIT = ethers.utils.parseEther("100000")
const ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS = WeiPerSixDecimals.mul(100000)

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

const ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT = ONE_PERCENT_OF_TOTAL_DEPOSIT.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT))
const ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT = ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.sub(ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS.div(DIVIDER_TO_FIT_SINGLE_SWAP_LIMIT))
const _convertSixDecimalsToEtherBalance = (balance) => {
    return balance.mul(1e12)
}


const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const stableswapMultipleSwapsMock = await artifacts.initializeInterfaceAt("StableswapMultipleSwapsMock", "StableswapMultipleSwapsMock");

    const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
    const stableSwapModuleWrapper = await getProxy(proxyFactory, "StableSwapModuleWrapper");


    const usdtAddr = await stableSwapModule.token()
    const USDT = await artifacts.initializeInterfaceAt("ERC20MintableStableSwap", usdtAddr);

    await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000 })
    await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000 })

    await USDT.mint(DeployerAddress, TO_DEPOSIT_USD.mul(2), { gasLimit: 1000000 })
    await fathomStablecoin.mint(DeployerAddress, TO_DEPOSIT.mul(2), { gasLimit: 1000000 })

    await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000 })

    await USDT.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
    await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
    await USDT.mint(DeployerAddress, TO_MINT_USD, { gasLimit: 1000000 })
    await fathomStablecoin.mint(DeployerAddress, TO_MINT, { gasLimit: 1000000 })

    await USDT.mint(AliceAddress, TO_MINT_USD, { gasLimit: 1000000 })
    await fathomStablecoin.mint(AliceAddress, TO_MINT, { gasLimit: 1000000 })

    return {
        USDT,
        stableSwapModule,
        fathomStablecoin,
        stableswapMultipleSwapsMock,
        stableSwapModuleWrapper
    }
}

describe("StableSwapModuleWrapper", () => {
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

    describe('#ShouldDepositTokens', async () => {
        context("Should deposit tokens", () => {
            it("Should deposit", async () => {
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000 })
            })
        })

        context("Should not deposit tokens and revert for not whitelisted people", () => {
            it("Should deposit", async () => {
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await USDT.mint(accounts[2], TO_DEPOSIT_USD, { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
                await expect(stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000, from: accounts[2] })).to.be.revertedWith("user-not-whitelisted");
            })
        })

        context("Should let whitelisted people deposit Tokens", () => {
            it("Should deposit from whitelisted address", async () => {
                await stableSwapModuleWrapper.addToWhitelist(accounts[2], { gasLimit: 1000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await USDT.mint(accounts[2], TO_DEPOSIT_USD, { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000, from: accounts[2] })
            })

            it("Should deposit from whitelisted address and after its removed from whitelist, should revert", async () => {
                await stableSwapModuleWrapper.addToWhitelist(accounts[2], { gasLimit: 1000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await USDT.mint(accounts[2], TO_DEPOSIT_USD, { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000, from: accounts[2] })
                await stableSwapModuleWrapper.removeFromWhitelist(accounts[2], { gasLimit: 1000000 })
                await expect(stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000, from: accounts[2] })).to.be.revertedWith("user-not-whitelisted");
            })
        })
    })

    describe('#ShouldDepositTokensAndSwap', async () => {
        context("Should let whitelisted people deposit Tokens and then swap", () => {
            it("Should deposit", async () => {
                await stableSwapModuleWrapper.addToWhitelist(accounts[2], { gasLimit: 1000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await USDT.mint(accounts[2], TO_DEPOSIT_USD, { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000 })
                await stableSwapModule.swapStablecoinToToken(accounts[2]
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                await stableSwapModule.swapStablecoinToToken(accounts[2]
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
            })
        })
    })

    describe("#feesTest-IsItFair?", async () => {
        context("1. whitelist multiple accounts, 2. deposit tokens with that account, 3. swap to generate fees, 4. claim and withdraw fees, 5. withdraw all tokens 6. total value locked is zero", async () => {
            it("Should claim and withdraw same fees for each depositor as they have same deposit amount", async () => {
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT = WeiPerWad.mul(1000)
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD = WeiPerSixDecimals.mul(1000)
                let TOTAL_FXD_BALANCE_AFTER_DEPOSIT = Array.from(Array(5))
                let TOTAL_TOKEN_BALANCE_AFTER_DEPOSIT = Array.from(Array(5))


                for (let i = 1; i < 5; i++) {
                    console.log(`depositing for account [${i}]`)
                    await stableSwapModuleWrapper.addToWhitelist(accounts[i], { gasLimit: 1000000 })
                    await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await USDT.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD, { gasLimit: 1000000 })
                    await fathomStablecoin.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000 })
                    
                    await stableSwapModuleWrapper.depositTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000, from: accounts[i] })
                    TOTAL_FXD_BALANCE_AFTER_DEPOSIT[i] = await fathomStablecoin.balanceOf(accounts[i])
                    TOTAL_TOKEN_BALANCE_AFTER_DEPOSIT[i] = await USDT.balanceOf(accounts[i])
                }

                for (let i = 1; i <= 5; i++) {
                    console.log("Swapping Token to Stablecoin - No...........", i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for (let i = 1; i <= 5; i++) {
                    console.log("Swapping Stablecoin to Token - No...........", i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

            

                for (let i = 1; i < 5; i++) {
                    const feesFromGetter = await stableSwapModuleWrapper.getClaimableFeesPerUser(accounts[i])
                    console.log('Total FXD from getter that can be claimed: ', feesFromGetter[0].toString())
                    console.log(`claiming for account [${i}]`)
                    
                    await stableSwapModuleWrapper.claimFeesRewards({ from: accounts[i], gasLimit: 8000000 })
                }

                let accountsBalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(accounts[1])
                await stableSwapModuleWrapper.withdrawClaimedFees({ from: accounts[1], gasLimit: 8000000 })
                let accountsBalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(accounts[1])
                let totalFXDWithdrawnAsFeesAccounts = (accountsBalanceAfterFeesWithdraw.sub(accountsBalanceBeforeFeesWithdraw)).toString()
                let currentAccountFXDFeesWithdrawn = totalFXDWithdrawnAsFeesAccounts
                let previousCurrentAccountFXDFeesWithdrawn
                
                
                for (let i = 2; i < 5; i++) {
                    previousCurrentAccountFXDFeesWithdrawn = currentAccountFXDFeesWithdrawn
                    const accountsBalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(accounts[i])
                    await stableSwapModuleWrapper.withdrawClaimedFees({ from: accounts[i], gasLimit: 8000000 })
                    const accountsBalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(accounts[i])
                    const totalFXDWithdrawnAsFeesAccounts = (accountsBalanceAfterFeesWithdraw.sub(accountsBalanceBeforeFeesWithdraw)).toString()
                    expect(previousCurrentAccountFXDFeesWithdrawn).to.be.eq(currentAccountFXDFeesWithdrawn)
                    currentAccountFXDFeesWithdrawn = totalFXDWithdrawnAsFeesAccounts
                    
                    console.log('Total FXD withdrawn as fees for accounts: \n', totalFXDWithdrawnAsFeesAccounts)
                }

                //checking if updatingTotalValueDepositedWorks
                const totalValueDepositedBeforeUpdate = await stableSwapModule.totalValueDeposited();
                await stableSwapModule.udpateTotalValueDeposited()
                const totalValueDepositedAfterUpdate = await stableSwapModule.totalValueDeposited();
                expect(totalValueDepositedAfterUpdate).to.be.equal(totalValueDepositedBeforeUpdate)

                await stableSwapModuleWrapper.claimFeesRewards({ from: accounts[0], gasLimit: 8000000 }) 
                await stableSwapModuleWrapper.withdrawClaimedFees({ from: accounts[0], gasLimit: 8000000 })
                await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2), { from: accounts[0], gasLimit: 8000000 })

                for(let i = 1; i< 5; i++){
                    console.log(`withdrawing whole liquidity of accounts[${i}]`)
                    await stableSwapModuleWrapper.withdrawTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT.mul(2), { from: accounts[i], gasLimit: 8000000 })
                    const TOTAL_FXD_BALANCE_AFTER_WITHDRAW = await fathomStablecoin.balanceOf(accounts[i])
                    const TOTAL_TOKEN_BALANCE_AFTER_WITHDRAW = await USDT.balanceOf(accounts[i])
                    
                    const TOTAL_TOKEN_BALANCE_AFTER_WITHDRAW_SCALED = _convertSixDecimalsToEtherBalance(TOTAL_TOKEN_BALANCE_AFTER_WITHDRAW)
                    const TOTAL_TOKEN_BALANCE_AFTER_DEPOSIT_SCALED = _convertSixDecimalsToEtherBalance(TOTAL_TOKEN_BALANCE_AFTER_DEPOSIT[i])
                    
                    const TOTAL_FXD_WITHDRAWN_FROM_SSM_WITH_FEES = TOTAL_FXD_BALANCE_AFTER_WITHDRAW.sub(TOTAL_FXD_BALANCE_AFTER_DEPOSIT[i])
                    const TOTAL_TOKEN_WITHDRAWN_FROM_SSM_WITH_FEES = TOTAL_TOKEN_BALANCE_AFTER_WITHDRAW_SCALED.sub(TOTAL_TOKEN_BALANCE_AFTER_DEPOSIT_SCALED)

                    expect(TOTAL_FXD_WITHDRAWN_FROM_SSM_WITH_FEES.add(TOTAL_TOKEN_WITHDRAWN_FROM_SSM_WITH_FEES)).to.be.gt(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT.mul(2))
                    console.log(`total liquidity of accounts[${i}] after withdrawing whole liquidity and with fees: `, TOTAL_FXD_WITHDRAWN_FROM_SSM_WITH_FEES.add(TOTAL_TOKEN_WITHDRAWN_FROM_SSM_WITH_FEES).toString())
                }
                
                const totalValueLockedInStableswap = await stableSwapModule.totalValueLocked();
                expect(totalValueLockedInStableswap.toString()).to.be.equal("0")

                
            })
        })

        context("1. whitelist multiple accounts, 2. deposit tokens with that account, 3. swap to generate fees, 4. withdraw the deposited tokens", async () => {
            it("Should withdraw tokens but the one that withdraws tokens earlier must have slightly less fees rewards", async () => {
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT = WeiPerWad.mul(1000)
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD = WeiPerSixDecimals.mul(1000)
                for (let i = 1; i < 5; i++) {
                    console.log(`depositing for account [${i}]`)
                    await stableSwapModuleWrapper.addToWhitelist(accounts[i], { gasLimit: 1000000 })
                    await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await USDT.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD, { gasLimit: 1000000 })
                    await fathomStablecoin.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000 })
                    await stableSwapModuleWrapper.depositTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000, from: accounts[i] })
                }

                for (let i = 1; i <= 5; i++) {
                    console.log("Swapping Token to Stablecoin - No...........", i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for (let i = 1; i <= 5; i++) {
                    console.log("Swapping Stablecoin to Token - No...........", i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                const accounts1BalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(accounts[1])
                await stableSwapModuleWrapper.withdrawTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { from: accounts[1], gasLimit: 8000000 })
                const accounts1BalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(accounts[1])
                const totalFXDWithdrawnAsFeesAccounts = (accounts1BalanceAfterFeesWithdraw.sub(accounts1BalanceBeforeFeesWithdraw)).toString()
                let currentAccountFXDFeesWithdrawn = totalFXDWithdrawnAsFeesAccounts
                let previousAccountFXDFeesWithdrawn

                for (let i = 2; i < 5; i++) {
                    previousAccountFXDFeesWithdrawn = currentAccountFXDFeesWithdrawn
                    const accountsBalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(accounts[i])
                    await stableSwapModuleWrapper.withdrawTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { from: accounts[i], gasLimit: 8000000 })
                    const accountsBalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(accounts[i])
                    const totalFXDWithdrawnAsFeesAccounts = (accountsBalanceAfterFeesWithdraw.sub(accountsBalanceBeforeFeesWithdraw)).toString()
                    currentAccountFXDFeesWithdrawn = totalFXDWithdrawnAsFeesAccounts
                    expect(parseInt(currentAccountFXDFeesWithdrawn)).to.be.gt(parseInt(previousAccountFXDFeesWithdrawn))
                    console.log(`Total FXD withdrawn plus fees for accounts: [${i}] - should be increasing a bit as the last one to withdraw must get the most fees \n`, totalFXDWithdrawnAsFeesAccounts)
                }
            })
        })
    })

    describe("#randomScenarioTesting", async () => {
        context("Scenario where LPs deposit and withdraw and swap happens at different times", async () => {
            it("Should be successful", async() => {
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT = WeiPerWad.mul(1000)
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD = WeiPerSixDecimals.mul(1000)
                //whitelist and deposit for 3 accounts
                for (let i = 1; i < 4; i++) {
                    console.log(`depositing for account [${i}]`)
                    await stableSwapModuleWrapper.addToWhitelist(accounts[i], { gasLimit: 1000000 })
                    await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await USDT.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD, { gasLimit: 1000000 })
                    await fathomStablecoin.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000 })
                    await stableSwapModuleWrapper.depositTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000, from: accounts[i] })
                }

                //swap to generate fees
                for (let i = 1; i <= 2; i++) {
                    console.log("Swapping Token to Stablecoin - No...........", i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for (let i = 1; i <= 2; i++) {
                    console.log("Swapping Stablecoin to Token - No...........", i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                await stableSwapModuleWrapper.withdrawTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT.mul(2), { from: accounts[1], gasLimit: 8000000 })
                
                await stableSwapModuleWrapper.addToWhitelist(accounts[4], { gasLimit: 1000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[4] })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[4] })
                await USDT.mint(accounts[4], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD, { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[4], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000 })
                await stableSwapModuleWrapper.depositTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000, from: accounts[4] })

                //swap to generate fees
                for (let i = 1; i <= 2; i++) {
                    console.log("Swapping Token to Stablecoin - No...........", i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for (let i = 1; i <= 2; i++) {
                    console.log("Swapping Stablecoin to Token - No...........", i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }
                
                await stableSwapModuleWrapper.withdrawTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT.mul(2), { from: accounts[2], gasLimit: 8000000 })
                await stableSwapModuleWrapper.withdrawTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT.mul(2), { from: accounts[3], gasLimit: 8000000 })   

                //swap to generate fees
                for (let i = 1; i <= 2; i++) {
                    console.log("Swapping Token to Stablecoin - No...........", i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for (let i = 1; i <= 2; i++) {
                    console.log("Swapping Stablecoin to Token - No...........", i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }
                await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2), { from: accounts[0], gasLimit: 8000000 })
                await stableSwapModuleWrapper.withdrawTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT.mul(2), { from: accounts[4], gasLimit: 8000000 })
                const totalValueLockedInStableswap = await stableSwapModule.totalValueLocked();
                expect(totalValueLockedInStableswap.toString()).to.be.equal("0")
            })
        })
    })

    describe('#withdrawTokens from Stableswap with stableswapWrapper', async () => {
        context("Should withdraw tokens from stableswap", () => {
            it("Should withdraw", async () => {
                await stableSwapModuleWrapper.withdrawTokens(
                    WeiPerWad,
                    {
                        from: DeployerAddress,
                        gasLimit: 8000000
                    }
                )
            })
        })

        context("Should withdraw tokens from stableswap as per the ratio with swap stablecoin to token", () => {
            it("Should withdraw", async () => {
                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                const balanceOfStablecoinBeforeWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                let balanceOfTokenBeforeWithdraw = await USDT.balanceOf(DeployerAddress)
                balanceOfTokenBeforeWithdraw = _convertSixDecimalsToEtherBalance(balanceOfTokenBeforeWithdraw)
                const amountToWithdraw = WeiPerWad.mul(200)
                await stableSwapModuleWrapper.withdrawTokens(
                    amountToWithdraw,
                    {
                        from: DeployerAddress,
                        gasLimit: 8000000
                    }
                )

                const balanceOfStablecoinAfterWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                let balanceOfTokenAfterWithdraw = await USDT.balanceOf(DeployerAddress)
                balanceOfTokenAfterWithdraw = _convertSixDecimalsToEtherBalance(balanceOfTokenAfterWithdraw)
                let tokenBalanceInStableSwap = await stableSwapModule.tokenBalance(USDT.address)
                tokenBalanceInStableSwap = _convertSixDecimalsToEtherBalance(tokenBalanceInStableSwap)
                const stablecoinBalanceInStableSwap = await stableSwapModule.tokenBalance(fathomStablecoin.address)

                //replication of formula in stableswap wrapper
                //_amount * _tokenBalance / (_tokenBalance + _stablecoinBalance)
                const expectedBalanceOfTokenInUser = amountToWithdraw.mul(tokenBalanceInStableSwap).div(tokenBalanceInStableSwap.add(stablecoinBalanceInStableSwap))
                //replication of formula in stableswap wrapper
                //_amount * _stablecoinBalance / (_tokenBalance + _stablecoinBalance)
                const expectedBalanceOfStablecoinInUser = amountToWithdraw.mul(stablecoinBalanceInStableSwap).div(tokenBalanceInStableSwap.add(stablecoinBalanceInStableSwap))

                //200 is withdrawn
                // 4 swaps from stablecoin to token
                // so, the balance of token should be around 104
                // balance of stablecoin after withdraw should be around 96
                const actualTransferOfBalanceOfStablecoin = balanceOfStablecoinAfterWithdraw.sub(balanceOfStablecoinBeforeWithdraw)
                const actualTransferOfBalanceOfToken = balanceOfTokenAfterWithdraw.sub(balanceOfTokenBeforeWithdraw)

                expect(actualTransferOfBalanceOfStablecoin).to.be.equal(expectedBalanceOfStablecoinInUser)
                expect(actualTransferOfBalanceOfToken).to.be.equal(expectedBalanceOfTokenInUser.add(WeiPerWad.mul(399600).div(1000))) //399.6 is the fee generated for four swaps

                console.log('200 is withdrawn, 4 swaps from stablecoin to token, so, the balance of stablecoin should be around 104 ether, the actual balance after accounting for fees is: \n',
                    actualTransferOfBalanceOfStablecoin.toString())

                console.log('200 is withdrawn, 4 swaps from stablecoin to token, so, the balance of token should be around 96 ether, the actual balance after accounting for fees is: \n',
                    actualTransferOfBalanceOfToken.toString()
                )

            })
        })

        context("Should withdraw tokens from stableswap as per the ratio with swap token to stablecoin", () => {
            it("Should withdraw", async () => {

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                const balanceOfStablecoinBeforeWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)

                let balanceOfTokenBeforeWithdraw = await USDT.balanceOf(DeployerAddress)
                balanceOfTokenBeforeWithdraw = _convertSixDecimalsToEtherBalance(balanceOfTokenBeforeWithdraw)

                const amountToWithdraw = WeiPerWad.mul(200)
                await stableSwapModuleWrapper.withdrawTokens(
                    WeiPerWad.mul(200),
                    {
                        from: DeployerAddress,
                        gasLimit: 8000000
                    }
                )

                const balanceOfStablecoinAfterWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                let balanceOfTokenAfterWithdraw = await USDT.balanceOf(DeployerAddress)
                balanceOfTokenAfterWithdraw = _convertSixDecimalsToEtherBalance(balanceOfTokenAfterWithdraw)
                let tokenBalanceInStableSwap = await stableSwapModule.tokenBalance(USDT.address)
                tokenBalanceInStableSwap = _convertSixDecimalsToEtherBalance(tokenBalanceInStableSwap)
                const stablecoinBalanceInStableSwap = await stableSwapModule.tokenBalance(fathomStablecoin.address)


                //replication of formula in stableswap wrapper
                //_amount * _tokenBalance / (_tokenBalance + _stablecoinBalance)
                const expectedBalanceOfTokenInUser = amountToWithdraw.mul(tokenBalanceInStableSwap).div(tokenBalanceInStableSwap.add(stablecoinBalanceInStableSwap))
                //replication of formula in stableswap wrapper
                //_amount * _stablecoinBalance / (_tokenBalance + _stablecoinBalance)
                const expectedBalanceOfStablecoinInUser = amountToWithdraw.mul(stablecoinBalanceInStableSwap).div(tokenBalanceInStableSwap.add(stablecoinBalanceInStableSwap))

                //200 is withdrawn
                // 4 swaps from stablecoin to token
                // so, the balance of token should be around 104
                // balance of stablecoin after withdraw should be around 96
                const actualTransferOfBalanceOfStablecoin = balanceOfStablecoinAfterWithdraw.sub(balanceOfStablecoinBeforeWithdraw)
                const actualTransferOfBalanceOfToken = balanceOfTokenAfterWithdraw.sub(balanceOfTokenBeforeWithdraw)

                expect(actualTransferOfBalanceOfStablecoin).to.be.equal(expectedBalanceOfStablecoinInUser.add(WeiPerWad.mul(399600).div(1000)))
                expect(actualTransferOfBalanceOfToken).to.be.equal(expectedBalanceOfTokenInUser)

                console.log('200 is withdrawn, 4 swaps from stablecoin to token, so, the balance of stablecoin should be around 96 ether, the actual balance after accounting for fees is: \n',
                    actualTransferOfBalanceOfStablecoin.toString())

                console.log('200 is withdrawn, 4 swaps from stablecoin to token, so, the balance of token should be around 104 ether, the actual balance after accounting for fees is: \n',
                    actualTransferOfBalanceOfToken.toString()
                )
            })
        })

        context("Should withdraw tokens from stableswap as per the ratio with swap token to stablecoin and swap stablecoin to token", () => {
            it("Should withdraw", async () => {
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })

                const balanceOfStablecoinBeforeWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                let balanceOfTokenBeforeWithdraw = await USDT.balanceOf(DeployerAddress)
                balanceOfTokenBeforeWithdraw = _convertSixDecimalsToEtherBalance(balanceOfTokenBeforeWithdraw)

                const amountToWithdraw = WeiPerWad.mul(1000)
                await stableSwapModuleWrapper.withdrawTokens(
                    amountToWithdraw,
                    {
                        from: DeployerAddress,
                        gasLimit: 8000000
                    }
                )

                const balanceOfStablecoinAfterWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                let balanceOfTokenAfterWithdraw = await USDT.balanceOf(DeployerAddress)
                balanceOfTokenAfterWithdraw = _convertSixDecimalsToEtherBalance(balanceOfTokenAfterWithdraw)
                let tokenBalanceInStableSwap = await stableSwapModule.tokenBalance(USDT.address)
                tokenBalanceInStableSwap = _convertSixDecimalsToEtherBalance(tokenBalanceInStableSwap)
                const stablecoinBalanceInStableSwap = await stableSwapModule.tokenBalance(fathomStablecoin.address)

                //replication of formula in stableswap wrapper
                //_amount * _tokenBalance / (_tokenBalance + _stablecoinBalance)
                const expectedBalanceOfTokenInUser = amountToWithdraw.mul(tokenBalanceInStableSwap).div(tokenBalanceInStableSwap.add(stablecoinBalanceInStableSwap))
                //replication of formula in stableswap wrapper
                //_amount * _stablecoinBalance / (_tokenBalance + _stablecoinBalance)
                const expectedBalanceOfStablecoinInUser = amountToWithdraw.mul(stablecoinBalanceInStableSwap).div(tokenBalanceInStableSwap.add(stablecoinBalanceInStableSwap))

                const actualTransferOfBalanceOfStablecoin = balanceOfStablecoinAfterWithdraw.sub(balanceOfStablecoinBeforeWithdraw)
                const actualTransferOfBalanceOfToken = balanceOfTokenAfterWithdraw.sub(balanceOfTokenBeforeWithdraw)

                expect(actualTransferOfBalanceOfStablecoin).to.be.equal(expectedBalanceOfStablecoinInUser.add(WeiPerWad.mul(399600).div(1000))) //339.6 fees from 4 swaps

                console.log('1000 is withdrawn, 4 swaps from stablecoin to token and 2 swaps from token to stableocoin, so, the balance of stablecoin should be around 499 ether, the actual balance after accounting for fees is: \n',
                    actualTransferOfBalanceOfStablecoin.toString())

                console.log('1000 is withdrawn, 4 swaps from stablecoin to token and 2 swaps from token to stablecoin, so, the balance of token should be around 501 ether, the actual balance after accounting for fees is: \n',
                    actualTransferOfBalanceOfToken.toString()
                )
                //this because it is reverting due to some reason
                await TimeHelpers.increase(1)
                await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2).sub(WeiPerWad.mul(1000)), { from: DeployerAddress, gasLimit: 8000000 })
            })
        })

        context('1. Whitelist one account, 2. swap tokens to generate fees, 3. withdraw tokens, 4. repeat steps 2 and 3', async () => {
            it('Should withdraw correct fees and check the console for verfication ', async () => {
                await stableSwapModuleWrapper.addToWhitelist(accounts[2], { gasLimit: 1000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await USDT.mint(accounts[2], TO_DEPOSIT_USD, { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000, from: accounts[2] })

                for (let i = 1; i <= 5; i++) {
                    console.log("Swapping Token to Stablecoin - No...........", i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for (let i = 1; i <= 5; i++) {
                    console.log("Swapping Stablecoin to Token - No...........", i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }


                await stableSwapModuleWrapper.claimFeesRewards({ from: accounts[2], gasLimit: 8000000 })
                await stableSwapModuleWrapper.claimFeesRewards({ from: DeployerAddress, gasLimit: 8000000 })
                //What is happening: WHen I switch it is not working correctly

                let DeployerBalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                await stableSwapModuleWrapper.withdrawClaimedFees({ from: DeployerAddress, gasLimit: 8000000 })
                let DeployerBalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                let totalFXDWithdrawnAsFeesDeployer = (DeployerBalanceAfterFeesWithdraw.sub(DeployerBalanceBeforeFeesWithdraw)).toString()
                console.log('Total FXD withdrawn as fees for deployer: \n', totalFXDWithdrawnAsFeesDeployer)

                let accounts2BalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(accounts[2])
                await stableSwapModuleWrapper.withdrawClaimedFees({ from: accounts[2], gasLimit: 8000000 })
                let accounts2BalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(accounts[2])
                let totalFXDWithdrawnAsFeesAccounts2 = (accounts2BalanceAfterFeesWithdraw.sub(accounts2BalanceBeforeFeesWithdraw)).toString()
                console.log('Total FXD withdrawn as fees for accounts2: \n', totalFXDWithdrawnAsFeesAccounts2)

                for (let i = 1; i <= 5; i++) {
                    console.log("Swapping Token to Stablecoin - No...........", i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for (let i = 1; i <= 5; i++) {
                    console.log("Swapping Stablecoin to Token - No...........", i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                accounts2BalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(accounts[2])
                await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2), { from: accounts[2], gasLimit: 8000000 })
                accounts2BalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(accounts[2])
                totalFXDWithdrawnAsFeesAccounts2 = (accounts2BalanceAfterFeesWithdraw.sub(accounts2BalanceBeforeFeesWithdraw)).toString()
                console.log('Total FXD withdrawn as fees for accounts2: \n', totalFXDWithdrawnAsFeesAccounts2)

                await TimeHelpers.increase(1)

                DeployerBalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2), { from: DeployerAddress, gasLimit: 8000000 })
                DeployerBalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                totalFXDWithdrawnAsFeesDeployer = (DeployerBalanceAfterFeesWithdraw.sub(DeployerBalanceBeforeFeesWithdraw)).toString()
                
                console.log('Total FXD withdrawn as fees for deployer: \n', totalFXDWithdrawnAsFeesDeployer)
            })
        })
    })

    describe("#decentralizedState", async () => {
        context("set decentralized state and deposit tokens by anybody", async () => {
            it("Should succeed", async () => {
                await stableSwapModuleWrapper.setIsDecentralizedState(true, { from: DeployerAddress })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { from: AliceAddress, gasLimit: 8000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { from: AliceAddress, gasLimit: 8000000 })
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { from: AliceAddress })
            })
        })

        context("set decentralized state and deposit tokens should succeed then, set decentralized state as false and should fail", async () => {
            it("Should succeed", async () => {
                await stableSwapModuleWrapper.setIsDecentralizedState(true, { from: DeployerAddress })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { from: accounts[1], gasLimit: 8000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { from: accounts[1], gasLimit: 8000000 })

                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { from: accounts[1] })
                await stableSwapModuleWrapper.setIsDecentralizedState(false, { from: DeployerAddress })
                await expect(
                    stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { from: accounts[1] })
                ).to.be.revertedWith("user-not-whitelisted");
            })
        })

    })

    describe("#depositTokens", async () => {
        context("deposit USDT and FXD as not whiteListed account", async () => {
            it("should fail", async () => {
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { from: accounts[1], gasLimit: 8000000 })
                await USDT.approve(stableSwapModule.address, MaxUint256, { from: accounts[1], gasLimit: 8000000 })
                await expect(
                    stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { from: accounts[1], gasLimit: 8000000 })
                ).to.be.revertedWith("user-not-whitelisted");
            })
        })

        context("deposit USDT and FXD as whiteListed account", async () => {
            it("should succeed", async () => {
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 8000000 })
                const depositTracker1 = await stableSwapModuleWrapper.depositTracker(DeployerAddress);
                expect(depositTracker1).to.be.equal(TO_DEPOSIT.mul(4))
            })
        })
    })



    describe('#amountGetters', async () => {
        context('#getAmounts', async () => {
            it('should return the correct amount of tokens', async () => {
                const amounts = await stableSwapModuleWrapper.getAmounts(TO_DEPOSIT)
                expect(amounts[0]).to.be.equal(TO_DEPOSIT.div(2))
                expect(amounts[1]).to.be.equal(TO_DEPOSIT.div(2))
            })
        })

        context('#getAmounts', async () => {
            it('should return the correct amount of tokens after swap', async () => {
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                const amounts = await stableSwapModuleWrapper.getAmounts(TO_DEPOSIT)
                expect(amounts[0]).to.be.lte(TO_DEPOSIT.div(2))
                expect(amounts[1]).to.be.gte(TO_DEPOSIT.div(2))
            })
        })

        context('#getActualLiquidityAvailablePerUser', async () => {
            it('should return the correct amount of tokens', async () => {
                const amounts = await stableSwapModuleWrapper.getActualLiquidityAvailablePerUser(DeployerAddress)
                expect(amounts[0]).to.be.equal(TO_DEPOSIT)
                expect(amounts[1]).to.be.equal(TO_DEPOSIT)
            })
        })
    })

    describe('#emergencyScenario', async () => {
        context("1. whitelist multiple accounts, 2. deposit tokens with that account, 3. swap to generate fees, 4. pause and emergencyWithdraw, 5. totalValueLocked = 0", async () => {
            it("Should withdraw tokens with emergencyWithdraw", async () => {
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT = WeiPerWad.mul(1000)
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD = WeiPerSixDecimals.mul(1000)
                for (let i = 1; i < 5; i++) {
                    console.log(`depositing for account [${i}]`)
                    await stableSwapModuleWrapper.addToWhitelist(accounts[i], { gasLimit: 1000000 })
                    await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await USDT.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD, { gasLimit: 1000000 })
                    await fathomStablecoin.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000 })
                    await stableSwapModuleWrapper.depositTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000, from: accounts[i] })
                }

                for (let i = 1; i <= 5; i++) {
                    console.log("Swapping Token to Stablecoin - No...........", i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for (let i = 1; i <= 5; i++) {
                    console.log("Swapping Stablecoin to Token - No...........", i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress, ONE_PERCENT_OF_TOTAL_DEPOSIT_SINGLE_SWAP_FIT, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for (let i = 0; i < 5; i++) {
                    console.log(`claiming for account [${i}]`)
                    await stableSwapModuleWrapper.claimFeesRewards({ from: accounts[i], gasLimit: 8000000 })
                    console.log(`withdrawing claimed fees for account [${i}]`)
                    await stableSwapModuleWrapper.withdrawClaimedFees({ from: accounts[i], gasLimit:8000000})
                }

                await stableSwapModuleWrapper.pause({ gasLimit: 1000000 })
                await stableSwapModule.pause({ gasLimit: 1000000 })

                for (let i = 0; i < 5; i++) {
                    console.log(`emergency withdraw for account [${i}]`)
                    await stableSwapModuleWrapper.emergencyWithdraw({ gasLimit: 1000000, from: accounts[i] })
                }

                const totalValueLockedInStableswap = await stableSwapModule.totalValueLocked();
                expect(totalValueLockedInStableswap.toString()).to.be.equal("0")
            })
        })
    })
})
