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
    const stableSwapModuleWrapper = await getProxy(proxyFactory, "StableSwapModuleWrapper");
    

    const usdtAddr = await stableSwapModule.token()
    const USDT = await artifacts.initializeInterfaceAt("ERC20Mintable", usdtAddr);

    await USDT.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000 })
    await fathomStablecoin.approve(stableSwapModuleWrapper.address, MaxUint256, { gasLimit: 1000000 })
    
    await USDT.mint(DeployerAddress, TO_DEPOSIT.mul(2), { gasLimit: 1000000 })
    await fathomStablecoin.mint(DeployerAddress, TO_DEPOSIT.mul(2), { gasLimit: 1000000 })

    await stableSwapModuleWrapper.depositTokens(TO_DEPOSIT,{ gasLimit: 1000000 })

    await USDT.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000})
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
