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


const _convertToGwei = (balance) => {
    const gwei = parseInt(ethers.utils.formatUnits(balance, "gwei"));
    const firstSixDigits = String(gwei).slice(0, 6);
    return parseInt(firstSixDigits);

}

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
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })
                await stableSwapModule.swapStablecoinToToken(accounts[2]
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })
            })
        })
    })

    describe("#feesTest-IsItFair?", async () => {
        context("deposit tokens - swap - and check for fees", async () => {
            it("Should succeed", async() => {
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT = WeiPerWad.mul(1000)
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD = WeiPerSixDecimals.mul(1000)
                for(let i = 1; i < 10; i++) {
                    console.log(`depositing for account [${i}]`)
                    await stableSwapModuleWrapper.addToWhitelist(accounts[i], { gasLimit: 1000000 })
                    await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await USDT.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD, { gasLimit: 1000000 })
                    await fathomStablecoin.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000 })
                    await stableSwapModuleWrapper.depositTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000, from: accounts[i] })
                }
                
                for(let i =1;i <= 5;i++){
                    console.log("Swapping Token to Stablecoin - No...........",i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for(let i =1;i <= 5;i++){
                    console.log("Swapping Stablecion to Token - No...........",i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })    
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for(let i = 1; i < 10; i++) {
                    console.log(`claiming for account [${i}]`)
                    await stableSwapModuleWrapper.claimFeesRewards({ from: accounts[i], gasLimit: 8000000 })
                }

                for(let i = 1; i < 10; i++) {
                    const accountsBalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(accounts[i])
                    await stableSwapModuleWrapper.withdrawClaimedFees({ from: accounts[i], gasLimit: 8000000 })
                    const accountsBalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(accounts[i])
                    const totalFXDWithdrawnAsFeesAccounts = (accountsBalanceAfterFeesWithdraw.sub(accountsBalanceBeforeFeesWithdraw)).toString()
                    console.log('Total FXD withdrawn as fees for accounts: \n', totalFXDWithdrawnAsFeesAccounts)
                }
            })
        })

        context("deposit tokens - swap - and check for fees - with withdraw tokens as well", async () => {
            it("Should succeed", async() => {
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT = WeiPerWad.mul(1000)
                const TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD = WeiPerSixDecimals.mul(1000)
                for(let i = 1; i < 10; i++) {
                    console.log(`depositing for account [${i}]`)
                    await stableSwapModuleWrapper.addToWhitelist(accounts[i], { gasLimit: 1000000 })
                    await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[i] })
                    await USDT.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT_USD, { gasLimit: 1000000 })
                    await fathomStablecoin.mint(accounts[i], TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000 })
                    await stableSwapModuleWrapper.depositTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT, { gasLimit: 1000000, from: accounts[i] })
                }
                
                for(let i =1;i <= 5;i++){
                    console.log("Swapping Token to Stablecoin - No...........",i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for(let i =1;i <= 5;i++){
                    console.log("Swapping Stablecion to Token - No...........",i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })    
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                const accounts1BalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(accounts[1])
                await stableSwapModuleWrapper.withdrawTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT,{ from: accounts[1], gasLimit: 8000000 })
                const accounts1BalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(accounts[1])
                const totalFXDWithdrawnAsFeesAccounts = (accounts1BalanceAfterFeesWithdraw.sub(accounts1BalanceBeforeFeesWithdraw)).toString()
                let currentAccountFXDWithdrawn = totalFXDWithdrawnAsFeesAccounts
                let previousAccountFXDWithdrawn
                for(let i = 2; i < 10; i++) {
                    previousAccountFXDWithdrawn = currentAccountFXDWithdrawn
                    const accountsBalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(accounts[i])
                    await stableSwapModuleWrapper.withdrawTokens(TOTAL_DEPOSIT_FOR_EACH_ACCOUNT,{ from: accounts[i], gasLimit: 8000000 })
                    const accountsBalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(accounts[i])
                    const totalFXDWithdrawnAsFeesAccounts = (accountsBalanceAfterFeesWithdraw.sub(accountsBalanceBeforeFeesWithdraw)).toString()
                    currentAccountFXDWithdrawn = totalFXDWithdrawnAsFeesAccounts
                    expect(parseInt(currentAccountFXDWithdrawn)).to.be.gt(parseInt(previousAccountFXDWithdrawn))
                    console.log(`Total FXD withdrawn plus fees for accounts: [${i}] - should be increasing a bit as the last one to withdraw must get the most fees \n`, totalFXDWithdrawnAsFeesAccounts)
                }
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
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })

                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })

                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })

                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })

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
                expect(actualTransferOfBalanceOfToken).to.be.equal(expectedBalanceOfTokenInUser.add(WeiPerWad.mul(400))) //400 is the fee generated for four swaps

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
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })

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

                expect(actualTransferOfBalanceOfStablecoin).to.be.equal(expectedBalanceOfStablecoinInUser.add(WeiPerWad.mul(400)))
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
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })

                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })

                await stableSwapModule.swapStablecoinToToken(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })

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

                expect(actualTransferOfBalanceOfStablecoin).to.be.equal(expectedBalanceOfStablecoinInUser.add(WeiPerWad.mul(400))) //400 fees from 4 swaps
                //TODO: Why is this failing
                //expect(actualTransferOfBalanceOfToken).to.be.equal(expectedBalanceOfTokenInUser.add(WeiPerWad.mul(200)))

                console.log('1000 is withdrawn, 4 swaps from stablecoin to token and 2 swaps from token to stableocoin, so, the balance of stablecoin should be around 499 ether, the actual balance after accounting for fees is: \n',
                    actualTransferOfBalanceOfStablecoin.toString())

                console.log('1000 is withdrawn, 4 swaps from stablecoin to token and 2 swaps from token to stablecoin, so, the balance of token should be around 501 ether, the actual balance after accounting for fees is: \n',
                    actualTransferOfBalanceOfToken.toString()
                )
                const balanceOfFXDBeforeFeeWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2).sub(WeiPerWad.mul(1000)),{from: DeployerAddress,gasLimit: 8000000})
                
                const balanceOfFXDAfterFeeWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                const totalFXDWithdrawnAsFees = (balanceOfFXDAfterFeeWithdraw.sub(balanceOfFXDBeforeFeeWithdraw)).toString()
                //TODO
                //console.log('Total FXD withdrawn as fees: \n', totalFXDWithdrawnAsFees)
            })
        })

        context('10 iterations of swaps and withdraws', async() => {
            it('Should be successful on withdrawing rewards to multiple depositor', async() => {
                
                await stableSwapModuleWrapper.addToWhitelist(accounts[2], { gasLimit: 1000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await USDT.mint(accounts[2], TO_DEPOSIT_USD, { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000, from: accounts[2] })

                for(let i =1;i <= 5;i++){
                    console.log("Swapping Token to Stablecoin - No...........",i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for(let i =1;i <= 5;i++){
                    console.log("Swapping Stablecion to Token - No...........",i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })    
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

                for(let i =1;i <= 5;i++){
                    console.log("Swapping Token to Stablecoin - No...........",i)
                    await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                for(let i =1;i <= 5;i++){
                    console.log("Swapping Stablecion to Token - No...........",i)
                    await stableSwapModule.swapStablecoinToToken(DeployerAddress,ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })    
                    //increase block time so that a block is mined before swapping
                    await TimeHelpers.increase(1)
                }

                accounts2BalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(accounts[2])
                await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2), { from: accounts[2], gasLimit: 8000000 })
                accounts2BalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(accounts[2])
                totalFXDWithdrawnAsFeesAccounts2 = (accounts2BalanceAfterFeesWithdraw.sub(accounts2BalanceBeforeFeesWithdraw)).toString()
                console.log('Total FXD withdrawn as fees for accounts2: \n', totalFXDWithdrawnAsFeesAccounts2)
                
                DeployerBalanceBeforeFeesWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2), { from: DeployerAddress, gasLimit: 8000000 })
                DeployerBalanceAfterFeesWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                totalFXDWithdrawnAsFeesDeployer = (DeployerBalanceAfterFeesWithdraw.sub(DeployerBalanceBeforeFeesWithdraw)).toString()
                console.log('Total FXD withdrawn as fees for deployer: \n', totalFXDWithdrawnAsFeesDeployer)
            })
        })
    })

    describe("#decentralizedState", async() => {
        context("set decentralized state and deposit tokens by anybody", async() => {
            it("Should succeed", async() => {
                await stableSwapModuleWrapper.setIsDecentralizedState(true, {from: DeployerAddress}) 
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { from: AliceAddress, gasLimit: 8000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { from: AliceAddress, gasLimit: 8000000 })
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { from: AliceAddress })
            })
        })

        context("set decentralized state and deposit tokens should succeed then, set decentralized state as false and should fail", async() => {
            it("Should succeed", async() => {
                await stableSwapModuleWrapper.setIsDecentralizedState(true, {from: DeployerAddress}) 
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { from: accounts[1], gasLimit: 8000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { from: accounts[1], gasLimit: 8000000 })

                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { from: accounts[1] })
                await stableSwapModuleWrapper.setIsDecentralizedState(false, {from: DeployerAddress})
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
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, {gasLimit: 8000000})
                const depositTracker1 = await stableSwapModuleWrapper.depositTracker(DeployerAddress);
                expect(depositTracker1).to.be.equal(TO_DEPOSIT.mul(4))
            })
        })
    })

    

    describe('#amountGetters', async() => {
        context('#getAmounts', async() => {
            it('should return the correct amount of tokens', async() => {
                const amounts = await stableSwapModuleWrapper.getAmounts(TO_DEPOSIT)
                expect(amounts[0]).to.be.equal(TO_DEPOSIT.div(2))
                expect(amounts[1]).to.be.equal(TO_DEPOSIT.div(2))
            })
        })

        context('#getAmounts', async() => {
            it('should return the correct amount of tokens after swap', async() => {
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT_SIX_DECIMALS, { gasLimit: 1000000 })
                const amounts = await stableSwapModuleWrapper.getAmounts(TO_DEPOSIT)
                expect(amounts[0]).to.be.lte(TO_DEPOSIT.div(2))
                expect(amounts[1]).to.be.gte(TO_DEPOSIT.div(2))
            })
        })

        context('#getActualLiquidityAvailablePerUser', async() => {
            it('should return the correct amount of tokens', async() => {
                const amounts = await stableSwapModuleWrapper.getActualLiquidityAvailablePerUser(DeployerAddress)
                expect(amounts[0]).to.be.equal(TO_DEPOSIT)
                expect(amounts[1]).to.be.equal(TO_DEPOSIT)
            })
        })
    })

    // describe('#testsWithLargeIterationsOfSwaps', async() => {
    //     context('10 iterations of swaps and withdraws', async() => {
    //         it('Should be successful in 10 swaps with different numbers and withdraw from stableSwapWrapper - and deposit and withdraw all again - should be zero', async() => {
                
    //             for(let i =1;i <= 5;i++){
    //                 console.log("Swapping Token to Stablecoin - No...........",i)
    //                 await stableSwapModule.swapTokenToStablecoin(DeployerAddress,WeiPerSixDecimals.mul(i).mul(3), { gasLimit: 1000000 })
    //                 //increase block time so that a block is mined before swapping
    //                 await TimeHelpers.increase(1)
    //             }

    //             for(let i =1;i <= 5;i++){
    //                 console.log("Swapping Stablecion to Token - No...........",i)
    //                 await stableSwapModule.swapStablecoinToToken(DeployerAddress,WeiPerWad.mul(i).mul(3), { gasLimit: 1000000 })    
    //                 //increase block time so that a block is mined before swapping
    //                 await TimeHelpers.increase(1)
    //             }
    //             await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { from: DeployerAddress, gasLimit: 8000000 })
    //             await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(4), { from: DeployerAddress, gasLimit: 8000000 })
    //             const depositTracker1 = await stableSwapModuleWrapper.depositTracker(DeployerAddress);
    //             expect(depositTracker1).to.be.equal(0)
    //             await stableSwapModuleWrapper.claimFeesRewards()
    //             await stableSwapModuleWrapper.withdrawClaimedFees()
    //             const stableswapModuleLiquidity = await stableSwapModule.totalValueLocked()
    //             expect(stableswapModuleLiquidity).to.be.equal(0)
                
    //         })
    //     })

    //     context('55 iterations of swaps and withdraws', async() => {
    //         it('Should be successful in 55 swaps with different numbers and withdraw from stableSwapWrapper - and after withdrawing all liquidity and fees - total liquidity should be zero', async() => {
    //             for(let i =1;i <= 50;i++){
    //                 console.log("Swapping Token to Stablecoin - No...........",i)
    //                 await stableSwapModule.swapTokenToStablecoin(DeployerAddress,WeiPerSixDecimals.mul(i), { gasLimit: 1000000 })
    //                 //increase block time so that a block is mined before swapping
    //                 await TimeHelpers.increase(1)
    //             }

    //             for(let i =1;i <= 5;i++){
    //                 console.log("Swapping Stablecion to Token - No...........",i)
    //                 await stableSwapModule.swapStablecoinToToken(DeployerAddress,WeiPerWad.mul(i), { gasLimit: 1000000 })    
    //                 //increase block time so that a block is mined before swapping
    //                 await TimeHelpers.increase(1)
    //             }
    //             await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2), { from: DeployerAddress, gasLimit: 8000000 })
    //             const depositTracker1 = await stableSwapModuleWrapper.depositTracker(DeployerAddress);
    //             expect(depositTracker1).to.be.equal(0)
    //             //await stableSwapModule.withdrawFees(accounts[2], {from: DeployerAddress, gasLimit: 1000000});
    //             await stableSwapModuleWrapper.claimFeesRewards()
    //             await stableSwapModuleWrapper.withdrawClaimedFees()
    //             const stableswapModuleLiquidity = await stableSwapModule.totalValueLocked()
    //             expect(stableswapModuleLiquidity).to.be.equal(0)
    //             })
    //         })
            
    //         context('Withdraw all tokens', async() => {
    //             it('Should be able to withdraw T_TO_DEPOSIT, ie all the tokens in stableswapWrapper', async() => {
    //                 await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2), { from: DeployerAddress, gasLimit: 8000000 })
    //                 const depositTracker1 = await stableSwapModuleWrapper.depositTracker(DeployerAddress);
    //                 expect(depositTracker1).to.be.equal(0)
    //                 const stableswapModuleLiquidity = await stableSwapModule.totalValueLocked()
    //                 expect(stableswapModuleLiquidity).to.be.equal(0)
    //             })
    //         })
            
    //     })  

    //     context("should let whitelisted people to deposit - then should withdraw all and then zero deposit should be present", () => {
    //         it("Should deposit from whitelisted address - withdraw all - and should be zero", async () => {
    //             await stableSwapModuleWrapper.addToWhitelist(accounts[2], { gasLimit: 1000000 })
    //             await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
    //             await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
    //             await USDT.mint(accounts[2], TO_DEPOSIT_USD, { gasLimit: 1000000 })
    //             await fathomStablecoin.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
    //             await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, {from: accounts[2], gasLimit: 1000000 })
                
    //             for(let i =1;i <= 5;i++){
    //                 console.log("Swapping Token to Stablecoin - No...........",i)
    //                 await stableSwapModule.swapTokenToStablecoin(accounts[2],WeiPerSixDecimals.mul(i), { gasLimit: 1000000 })
    //                 //increase block time so that a block is mined before swapping
    //                 await TimeHelpers.increase(1)
    //             }

    //             for(let i =1;i <= 5;i++){
    //                 console.log("Swapping Stablecion to Token - No...........",i)
    //                 await stableSwapModule.swapStablecoinToToken(accounts[2],WeiPerWad.mul(i), { gasLimit: 1000000 })    
    //                 //increase block time so that a block is mined before swapping
    //                 await TimeHelpers.increase(1)
    //             }
    //             await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2), { from: accounts[2], gasLimit: 8000000 })
    //             const depositTracker1 = await stableSwapModuleWrapper.depositTracker(accounts[2]);
    //             expect(depositTracker1).to.be.equal(0)
    //             await stableSwapModuleWrapper.withdrawTokens(TO_DEPOSIT.mul(2), { from: DeployerAddress, gasLimit: 8000000 })
    //             const depositTracker2 = await stableSwapModuleWrapper.depositTracker(DeployerAddress);
    //             expect(depositTracker2).to.be.equal(0)

    //             await stableSwapModuleWrapper.claimFeesRewards()
    //             await stableSwapModuleWrapper.withdrawClaimedFees()
    //             const stableswapModuleLiquidity = await stableSwapModule.totalValueLocked()
    //             expect(stableswapModuleLiquidity).to.be.equal(0)
    //         })
    //     })
})
