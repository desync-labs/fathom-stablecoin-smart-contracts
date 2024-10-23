const { getProxy } = require("../../common/proxies");

const { BigNumber } = require("ethers");
const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`);

// [wad = 100%]
const SSM_FEE_IN = WeiPerWad.div(1000);
const SSM_FEE_OUT = WeiPerWad.div(1000);
const FMM_FEE = WeiPerWad.mul(4).div(1000);

module.exports = async function (deployer) {
  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

  const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
  const flashMintModule = await getProxy(proxyFactory, "FlashMintModule");

  await stableSwapModule.setFeeIn(SSM_FEE_IN, { gasLimit: 1000000 });
  await stableSwapModule.setFeeOut(SSM_FEE_OUT, { gasLimit: 1000000 });

  await flashMintModule.setFeeRate(FMM_FEE, { gasLimit: 1000000 });
  await flashMintModule.setMax(WeiPerWad.mul("1000000000"), { gasLimit: 1000000 });
};
