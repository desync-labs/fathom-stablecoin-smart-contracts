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
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000 })
            })

            it("Should deposit from whitelisted address and after its removed from whitelist, should revert", async () => {
                await stableSwapModuleWrapper.addToWhitelist(accounts[2], { gasLimit: 1000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await USDT.mint(accounts[2], TO_DEPOSIT_USD, { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000 })
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

                const actualTransferOfBalanceOfStablecoinGweiString = _convertToGwei(actualTransferOfBalanceOfStablecoin).toString()
                const actualTransferOfBalanceOfTokenGweiString = _convertToGwei(actualTransferOfBalanceOfToken).toString()
                const expectedBalanceOfStablecoinInUserGweiString = _convertToGwei(expectedBalanceOfStablecoinInUser).toString()
                const expectedBalanceOfTokenInUserGweiString = _convertToGwei(expectedBalanceOfTokenInUser).toString()

                expect(actualTransferOfBalanceOfStablecoinGweiString).to.be.equal(expectedBalanceOfStablecoinInUserGweiString)
                expect(actualTransferOfBalanceOfTokenGweiString).to.be.equal(expectedBalanceOfTokenInUserGweiString)

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

                const actualTransferOfBalanceOfStablecoinGweiString = _convertToGwei(actualTransferOfBalanceOfStablecoin).toString()
                const actualTransferOfBalanceOfTokenGweiString = _convertToGwei(actualTransferOfBalanceOfToken).toString()
                const expectedBalanceOfStablecoinInUserGweiString = _convertToGwei(expectedBalanceOfStablecoinInUser).toString()
                const expectedBalanceOfTokenInUserGweiString = _convertToGwei(expectedBalanceOfTokenInUser).toString()

                expect(actualTransferOfBalanceOfStablecoinGweiString).to.be.equal(expectedBalanceOfStablecoinInUserGweiString)
                expect(actualTransferOfBalanceOfTokenGweiString).to.be.equal(expectedBalanceOfTokenInUserGweiString)

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

                const actualTransferOfBalanceOfStablecoinGweiString = _convertToGwei(actualTransferOfBalanceOfStablecoin).toString()
                const actualTransferOfBalanceOfTokenGweiString = _convertToGwei(actualTransferOfBalanceOfToken).toString()
                const expectedBalanceOfStablecoinInUserGweiString = _convertToGwei(expectedBalanceOfStablecoinInUser).toString()
                const expectedBalanceOfTokenInUserGweiString = _convertToGwei(expectedBalanceOfTokenInUser).toString()

                
                //200 is withdrawn
                // 4 swaps from stablecoin to token
                // so, the balance of token should be around 104
                // balance of stablecoin after withdraw should be around 96
                expect(actualTransferOfBalanceOfStablecoinGweiString).to.be.equal(expectedBalanceOfStablecoinInUserGweiString)
                expect(actualTransferOfBalanceOfTokenGweiString).to.be.equal(expectedBalanceOfTokenInUserGweiString)

                console.log('200 is withdrawn, 4 swaps from stablecoin to token and 2 swaps from token to stableocoin, so, the balance of stablecoin should be around 499 ether, the actual balance after accounting for fees is: \n',
                    actualTransferOfBalanceOfStablecoin.toString())

                console.log('200 is withdrawn, 4 swaps from stablecoin to token and 2 swaps from token to stablecoin, so, the balance of token should be around 501 ether, the actual balance after accounting for fees is: \n',
                    actualTransferOfBalanceOfToken.toString()
                )
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
                const amounts = await stableSwapModuleWrapper.getActualLiquidityAvailablePerUser()
                expect(amounts[0]).to.be.equal(TO_DEPOSIT.div(2))
                expect(amounts[1]).to.be.equal(TO_DEPOSIT.div(2))
            })
        })
    })
})

