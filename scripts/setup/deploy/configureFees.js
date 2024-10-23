const { ethers } = require("hardhat");
const { BigNumber } = ethers;

const { getProxy } = require("../../../common/proxies");

const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`);
// [wad = 100%]
const SSM_FEE_IN = WeiPerWad.div(1000);
const SSM_FEE_OUT = WeiPerWad.div(1000);
const FMM_FEE = WeiPerWad.mul(4).div(1000);

async function configureFees(deployments) {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

  const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule")
  const flashMintModule = await getProxy(proxyFactory, "FlashMintModule");

  await stableSwapModule.setFeeIn(SSM_FEE_IN);
  await stableSwapModule.setFeeOut(SSM_FEE_OUT);

  await flashMintModule.setFeeRate(FMM_FEE);
  await flashMintModule.setMax(WeiPerWad.mul("1000000000"));
}

module.exports = {
  configureFees,
};