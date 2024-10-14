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

  await showStopper.setBookKeeper(bookKeeper.address, { gasLimit: 1000000 });
  await showStopper.setLiquidationEngine(liquidationEngine.address, { gasLimit: 1000000 });
  await showStopper.setSystemDebtEngine(systemDebtEngine.address, { gasLimit: 1000000 });
  await showStopper.setPriceOracle(priceOracle.address, { gasLimit: 1000000 });
}

module.exports = {
  configureShowStopper,
};
