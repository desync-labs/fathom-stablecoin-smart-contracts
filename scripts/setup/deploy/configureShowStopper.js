const { ethers } = require("hardhat");
const { getProxy } = require("../../../common/proxies");

async function configureShowStopper(deployments) {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

  const showStopper = await getProxy(proxyFactory, "ShowStopper");
  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
  const systemDebtEngine = await getProxy(proxyFactory, "SystemDebtEngine");
  const priceOracle = await getProxy(proxyFactory, "PriceOracle");

  await showStopper.setBookKeeper(bookKeeper.address);
  await showStopper.setLiquidationEngine(liquidationEngine.address);
  await showStopper.setSystemDebtEngine(systemDebtEngine.address);
  await showStopper.setPriceOracle(priceOracle.address);
}

module.exports = {
  configureShowStopper,
};