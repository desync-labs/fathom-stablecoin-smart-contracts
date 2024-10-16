const { getConfig, token } = require("../common/swtich-price-feed-helper");

task("switch-price-feed", "Switch price feed").setAction(async () => {
  async function getProxy(proxyFactory, contract) {
    const address = await proxyFactory.proxies(ethers.utils.formatBytes32String(contract));
    return await ethers.getContractAt(contract, address);
  }

  async function getProxyById(proxyFactory, contract, proxyId) {
    const address = await proxyFactory.proxies(proxyId);
    return await ethers.getContractAt(contract, address);
  }

  const config = getConfig(hre.network.config.chainId);
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", config.FathomProxyFactory);
  const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
  const subscriptionsRegistry = await ethers.getContractAt("ISubscriptionsRegistry", config.SubscriptionsRegistry);
  const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
  let fathomPriceOracle;
  let centralizedOraclePriceFeed;
  //need to instantiate a contract using directly address
  if (token == "NATIVE") {
    console.log("PriceSwitching for NATIVE");
    fathomPriceOracle = await getProxy(proxyFactory, "FathomPriceOracle");
    centralizedOraclePriceFeed = await getProxy(proxyFactory, "CentralizedOraclePriceFeed");
  } else {
    console.log(`PriceSwitching for ${token}`);
    const proxyIdSwitchPriceFeed = ethers.utils.formatBytes32String(`FathomPriceOracle_${token}`);
    fathomPriceOracle = await getProxyById(proxyFactory, "FathomPriceOracle", proxyIdSwitchPriceFeed);
    const proxyIdCentralizedOraclePriceFeed = ethers.utils.formatBytes32String(`CentralizedOraclePriceFeed_${token}`);
    centralizedOraclePriceFeed = await getProxyById(proxyFactory, "CentralizedOraclePriceFeed", proxyIdCentralizedOraclePriceFeed);
  }
  // scripting of below doc
  // https://docs.google.com/document/d/1_Hmuyz-iwI1MdmtlL56FySoNm3Gxedt0TV2LzmPFVFI/edit?usp=sharing
  // 0)subscribe to aggregator
  await subscriptionsRegistry.masterSubscribe(fathomPriceOracle.address, config.PriceAggregator);
  // 1)FathomPriceOracle.initialize(accessControlConfig, PriceAggregator)
  await fathomPriceOracle.initialize(accessControlConfig.address, config.PriceAggregator);
  // 2)Call peekPrice() twice on CentralizedOraclePriceFeed_Token.
  await centralizedOraclePriceFeed.peekPrice();
  await centralizedOraclePriceFeed.peekPrice();
  // 3)CollateralPoolConfig.setPriceFeed(CentralizedOraclePriceFeed_Token)
  await collateralPoolConfig.setPriceFeed(centralizedOraclePriceFeed.address);
});

module.exports = {};
