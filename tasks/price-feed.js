const { getAddresses } = require("../common/addresses");

task("price-feed", "Price Feed")
  .addParam("proxyFactoryAddress", "The address of the FathomProxyFactory contract")
  .setAction(async (taskArgs) => {
    async function getProxy(proxyFactory, contract) {
      const address = await proxyFactory.proxies(ethers.utils.formatBytes32String(contract));
      return await ethers.getContractAt(contract, address);
    }

    const proxyFactory = await ethers.getContractAt("FathomProxyFactory", taskArgs.proxyFactoryAddress);

    const delayFathomOraclePriceFeed = await getProxy(proxyFactory, "DelayFathomOraclePriceFeed");
    const dexPriceOracle = await getProxy(proxyFactory, "DexPriceOracle");
    // const centralizedOraclePriceFeed = await getProxy(proxyFactory, "CentralizedOraclePriceFeed");
    const slidingWindowDexOracle = await getProxy(proxyFactory, "SlidingWindowDexOracle");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");

    const addresses = getAddresses(hre.network.config.chainId);

    await dexPriceOracle.initialize(addresses.DEXFactory);
    await slidingWindowDexOracle.initialize(addresses.DEXFactory, 1800, 15);
    await delayFathomOraclePriceFeed.initialize(dexPriceOracle.address, addresses.WXDC, addresses.USD, accessControlConfig.address, pools.XDC);
  });

module.exports = {};
