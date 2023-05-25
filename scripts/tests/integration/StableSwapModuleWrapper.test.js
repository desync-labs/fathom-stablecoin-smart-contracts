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

const TO_DEPOSIT = ethers.utils.parseEther("10000000")
const TO_MINT = ethers.utils.parseEther("20000000")
const TWENTY_PERCENT_OF_TO_DEPOSIT = ethers.utils.parseEther("4000000") //20Million * 20% = 400k
const THIRTY_PERCENT_OF_TO_DEPOSIT = ethers.utils.parseEther("6000000")
const ONE_PERCENT_OF_TOTAL_DEPOSIT = ethers.utils.parseEther("100000")
const FOURTY_PERCENT_OF_TO_DEPOSIT = ethers.utils.parseEther("8000000")
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

    await USDT.mint(DeployerAddress, TO_DEPOSIT.mul(2), { gasLimit: 1000000 })
    await fathomStablecoin.mint(DeployerAddress, TO_DEPOSIT.mul(2), { gasLimit: 1000000 })

    await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000 })

    await USDT.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
    await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
    await USDT.mint(DeployerAddress, TO_MINT, { gasLimit: 1000000 })
    await fathomStablecoin.mint(DeployerAddress, TO_MINT, { gasLimit: 1000000 })

    await USDT.mint(AliceAddress, TO_MINT, { gasLimit: 1000000 })
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
                await USDT.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
                await expect(stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000, from: accounts[2] })).to.be.revertedWith("user-not-whitelisted");
            })
        })

        context("Should let whitelisted people deposit Tokens", () => {
            it("Should deposit from whitelisted address", async () => {
                await stableSwapModuleWrapper.addToWhitelist(accounts[2], { gasLimit: 1000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await USDT.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 1000000 })
            })

            it("Should deposit from whitelisted address and after its removed from whitelist, should revert", async () => {
                await stableSwapModuleWrapper.addToWhitelist(accounts[2], { gasLimit: 1000000 })
                await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000, from: accounts[2] })
                await USDT.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
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
                await USDT.mint(accounts[2], TO_DEPOSIT, { gasLimit: 1000000 })
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
                const balanceOfTokenBeforeWithdraw = await USDT.balanceOf(DeployerAddress)

                await stableSwapModuleWrapper.withdrawTokens(
                    WeiPerWad.mul(200),
                    {
                        from: DeployerAddress,
                        gasLimit: 8000000
                    }
                )

                const balanceOfStablecoinAfterWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                const balanceOfTokenAfterWithdraw = await USDT.balanceOf(DeployerAddress)
                const tokenBalanceInStableSwap = await stableSwapModule.tokenBalance(USDT.address)
                const stablecoinBalanceInStableSwap = await stableSwapModule.tokenBalance(fathomStablecoin.address)

                const shouldBeBalanceOfTokenInUser = WeiPerWad.mul(200).mul(tokenBalanceInStableSwap).div(tokenBalanceInStableSwap.add(stablecoinBalanceInStableSwap))
                const shouldBeBalanceOfStablecoinInUser = WeiPerWad.mul(200).mul(stablecoinBalanceInStableSwap).div(tokenBalanceInStableSwap.add(stablecoinBalanceInStableSwap))
                //200 is withdrawn
                // 4 swaps from stablecoin to token
                // so, the balance of token should be around 104
                // balance of stablecoin after withdraw should be around 96
                expect(balanceOfStablecoinAfterWithdraw.sub(balanceOfStablecoinBeforeWithdraw)).to.be.equal(shouldBeBalanceOfStablecoinInUser)
                expect(balanceOfTokenAfterWithdraw.sub(balanceOfTokenBeforeWithdraw)).to.be.equal(shouldBeBalanceOfTokenInUser)

                console.log('200 is withdrawn, 4 swaps from stablecoin to token, so, the balance of stablecoin should be around 104 ether, the actual balance after accounting for fees is: \n',
                    balanceOfStablecoinAfterWithdraw.sub(balanceOfStablecoinBeforeWithdraw).toString())

                console.log('200 is withdrawn, 4 swaps from stablecoin to token, so, the balance of token should be around 96 ether, the actual balance after accounting for fees is: \n',
                    balanceOfTokenAfterWithdraw.sub(balanceOfTokenBeforeWithdraw).toString()
                )

            })
        })

        context("Should withdraw tokens from stableswap as per the ratio with swap token to stablecoin", () => {
            it("Should withdraw", async () => {
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(DeployerAddress
                    , ONE_PERCENT_OF_TOTAL_DEPOSIT, { gasLimit: 1000000 })

                const balanceOfStablecoinBeforeWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                const balanceOfTokenBeforeWithdraw = await USDT.balanceOf(DeployerAddress)

                await stableSwapModuleWrapper.withdrawTokens(
                    WeiPerWad.mul(200),
                    {
                        from: DeployerAddress,
                        gasLimit: 8000000
                    }
                )

                const balanceOfStablecoinAfterWithdraw = await fathomStablecoin.balanceOf(DeployerAddress)
                const balanceOfTokenAfterWithdraw = await USDT.balanceOf(DeployerAddress)
                const tokenBalanceInStableSwap = await stableSwapModule.tokenBalance(USDT.address)
                const stablecoinBalanceInStableSwap = await stableSwapModule.tokenBalance(fathomStablecoin.address)

                const shouldBeBalanceOfTokenInUser = WeiPerWad.mul(200).mul(tokenBalanceInStableSwap).div(tokenBalanceInStableSwap.add(stablecoinBalanceInStableSwap))
                const shouldBeBalanceOfStablecoinInUser = WeiPerWad.mul(200).mul(stablecoinBalanceInStableSwap).div(tokenBalanceInStableSwap.add(stablecoinBalanceInStableSwap))
                //200 is withdrawn
                // 4 swaps from stablecoin to token
                // so, the balance of token should be around 104
                // balance of stablecoin after withdraw should be around 96
                expect(balanceOfStablecoinAfterWithdraw.sub(balanceOfStablecoinBeforeWithdraw)).to.be.equal(shouldBeBalanceOfStablecoinInUser)
                expect(balanceOfTokenAfterWithdraw.sub(balanceOfTokenBeforeWithdraw)).to.be.equal(shouldBeBalanceOfTokenInUser)

                console.log('200 is withdrawn, 4 swaps from stablecoin to token, so, the balance of stablecoin should be around 96 ether, the actual balance after accounting for fees is: \n',
                    balanceOfStablecoinAfterWithdraw.sub(balanceOfStablecoinBeforeWithdraw).toString())

                console.log('200 is withdrawn, 4 swaps from stablecoin to token, so, the balance of token should be around 104 ether, the actual balance after accounting for fees is: \n',
                    balanceOfTokenAfterWithdraw.sub(balanceOfTokenBeforeWithdraw).toString()
                )

            })
            context("deposit USDT and FXD as whiteListed account", async () => {
                it("should succeed", async () => {
                    await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { gasLimit: 8000000 })
                    //depositing T_TO_Deposit for each amount, so total amount for deposit Tracker of deployer address is 4*T_TO_DEPOSIT
                    const depositTracker1 = await stableSwapModuleWrapper.depositTracker(DeployerAddress);
                    expect(depositTracker1).to.be.equal(TO_DEPOSIT.mul(4))
                })
            })
    
        })

        //TODO: decentralized state testing
        //TODO: more withdraw tokens testing

    describe("#depositTokens", async () => {
        context("deposit USDT and FXD as not whiteListed account", async () => {
            it("should fail", async () => {
                await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { from : AliceAddress, gasLimit:8000000 } )
                await USDT.approve(stableSwapModule.address, MaxUint256, { from: AliceAddress, gasLimit: 8000000 } )

                expect(
                    stableSwapModuleWrapper.depositTokens(100, { from : AliceAddress })
                ).to.be.revertedWith("user-not-whitelisted");
            })
        })

        context("deposit USDT and FXD as whiteListed account", async () => {
            it("should succeed", async () => {
                // await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { from : DeployerAddress, gasLimit:8000000 } )
                // await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { from: DeployerAddress, gasLimit: 8000000 } )

                await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT, { from : DeployerAddress })

                // const depositTracker0 = await stableSwapModuleWrapper.depositTracker(DeployerAddress);
                // expect(depositTracker0).to.be.equal(ethers.utils.parseEther("0"))

                // await stableSwapModuleWrapper.depositTokens("150", { from : DeployerAddress })

                const depositTracker1 = await stableSwapModuleWrapper.depositTracker(DeployerAddress);
                expect(depositTracker1).to.be.equal(ethers.utils.parseEther("2"))
            })
        })


    })
})
