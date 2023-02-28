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

const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
    
    const usdtAddr = await stableSwapModule.token()
    const USDT = await artifacts.initializeInterfaceAt("ERC20Mintable", usdtAddr);

    await fathomStablecoin.mint(DeployerAddress, ethers.utils.parseEther("10000000"), { gasLimit: 1000000 })

    await USDT.mint(accounts[0], ethers.utils.parseEther("1000000"), { gasLimit: 1000000 })
    await USDT.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
    await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
    
    await stableSwapModule.depositToken(USDT.address,ethers.utils.parseEther("100000"),{ gasLimit: 1000000 })
    await stableSwapModule.depositToken(fathomStablecoin.address,ethers.utils.parseEther("100000"),{ gasLimit: 1000000 })

    return {
        USDT,
        stableSwapModule,
        fathomStablecoin,
    }
}

describe("StableSwapModule", () => {
    // Contracts
    let USDT
    let stableSwapModule
    let fathomStablecoin

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            USDT,
            stableSwapModule,
            fathomStablecoin,
        } = await loadFixture(setup));
    })

    describe("#swapTokenToStablecoin", async () => {
        context("swap USDT to FXD", async () => {
            it("should success", async () => {
                //accounts[5] setup
                await USDT.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000, from : accounts[5] })
                await fathomStablecoin.approve(stableSwapModule.address, WeiPerWad.mul(2500000), { gasLimit: 1000000, from: accounts[5] })
                await USDT.mint(accounts[5], ethers.utils.parseEther("10000"), { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[5], ethers.utils.parseEther("10000"), { gasLimit: 1000000 })

                await stableSwapModule.swapTokenToStablecoin(accounts[5],ethers.utils.parseEther("1000"), { gasLimit: 1000000, from: accounts[5] })
                const balanceOfStablecoin = await fathomStablecoin.balanceOf(accounts[5])
                const balanceOfUSDT = await USDT.balanceOf(accounts[5])
                //10000 -> initial balance, 1000 -> from swap, -ve 1 -> from fee. Total balance = 10000+1000-1 = 10999
                expect(balanceOfStablecoin).to.be.equal(ethers.utils.parseEther("10999"))
                //10000 -> initial balance, -ve 1000 -> from swap. Total Balance = 10000 - 1000 = 9000
                expect(balanceOfUSDT).to.be.equal(ethers.utils.parseEther("9000"))
            })
        })
    })

    describe("#swapStablecoinToToken", async () => {
        context("collateral not enough", async () => {
            it("should SWAP", async () => {
                 //accounts[5] setup
                await USDT.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000, from : accounts[5] })
                await fathomStablecoin.approve(stableSwapModule.address, WeiPerWad.mul(2500000), { gasLimit: 1000000, from: accounts[5] })
                await USDT.mint(accounts[5], ethers.utils.parseEther("10000"), { gasLimit: 1000000 })
                await fathomStablecoin.mint(accounts[5], ethers.utils.parseEther("10000"), { gasLimit: 1000000 })

                await stableSwapModule.swapStablecoinToToken(accounts[5],ethers.utils.parseEther("1000"), { gasLimit: 1000000, from: accounts[5] })
                const balanceOfStablecoin = await fathomStablecoin.balanceOf(accounts[5])
                const balanceOfUSDT = await USDT.balanceOf(accounts[5])
                ///10000 -> initial balance, -ve 1000 -> from swap Total balance = 10000-1000 = 9000
                expect(balanceOfStablecoin).to.be.equal(ethers.utils.parseEther("9000"))
                ///10000 -> initial balance, 1000 -> from swap, -ve 1 -> from fee. Total balance = 10000+1000-1 = 10999
                expect(balanceOfUSDT).to.be.equal(ethers.utils.parseEther("10999"))
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

    describe("#dailyLimitCheck", async () => {
        context("check for daily limit", async() => {
            it("Should be swap tokens and generate fees with check on daily limit", async() => {
                //first swap which takes all the allowance
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress,ethers.utils.parseEther("10000"), { gasLimit: 1000000 })
                //revert because it exceed allowance
                await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress,ethers.utils.parseEther("100"), { gasLimit: 1000000 })
                ).to.be.revertedWith("_udpateAndCheckDailyLimit/daily-limit-exceeded")
                await expect(stableSwapModule.swapStablecoinToToken(DeployerAddress,ethers.utils.parseEther("100"), { gasLimit: 1000000 })
                ).to.be.revertedWith("_udpateAndCheckDailyLimit/daily-limit-exceeded")
                const ONE_DAY = 86400
                await TimeHelpers.increase(ONE_DAY+20)
                //again swap after increasing timestamp
                //should succeed
                await stableSwapModule.swapStablecoinToToken(DeployerAddress,ethers.utils.parseEther("5000"), { gasLimit: 1000000 })
                await stableSwapModule.swapStablecoinToToken(DeployerAddress,ethers.utils.parseEther("5000"), { gasLimit: 1000000 })
                await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress,ethers.utils.parseEther("1"), { gasLimit: 1000000 })
                ).to.be.revertedWith("_udpateAndCheckDailyLimit/daily-limit-exceeded")
                //first swap FXDFee = 10000 * 0.001 = 10
                //second swap tokenFee = 5000 * 0.001 = 5
                //third swap tokenFee= 5000 * 0.001 = 5
                // FXDfee = 10
                // TokenFee = 5 + 5 = 10
                await stableSwapModule.withdrawFees(accounts[2]);
                const FXDfeeFromSwap = await fathomStablecoin.balanceOf(accounts[2])
                expect(FXDfeeFromSwap).to.be.equal(ethers.utils.parseEther("10"))
                const USDTfeeFromSwap = await USDT.balanceOf(accounts[2])
                expect(USDTfeeFromSwap).to.be.equal(ethers.utils.parseEther("10"))
            })
        })
    })

    describe("#stableSwapEmergencyWithdraw", async () => {
        it("Should emergency withdraw when paused", async() =>{
            await expect(stableSwapModule.emergencyWithdraw(accounts[5])).to.be.reverted;
            await stableSwapModule.pause();
            await stableSwapModule.emergencyWithdraw(accounts[5]);
            const balanceOfStablecoin = await fathomStablecoin.balanceOf(accounts[5])
            const balanceOfToken = await USDT.balanceOf(accounts[5])
            expect(balanceOfStablecoin).to.be.equal(ethers.utils.parseEther("100000"))
            expect(balanceOfToken).to.be.equal(ethers.utils.parseEther("100000"))
        })
    })
})
