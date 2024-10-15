const fs = require("fs");
const { ethers } = require("hardhat");

const { getProxy, getProxyById } = require("../../../common/proxies");
const { getConfig, getProxyId, token, poolId } = require("../../../common/add-collateral-helper");

async function initialize(getChainId) {
  const chainId = await getChainId();
  const config = getConfig(chainId);

  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", config.fathomProxyFactory);
  const proxyWalletFactory = await getProxy(proxyFactory, "ProxyWalletFactory");
  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");

  const collateralTokenAdapter = await getProxyById(proxyFactory, "CollateralTokenAdapter", getProxyId("CollateralTokenAdapter"));
  const fathomPriceOracle = await getProxyById(proxyFactory, "FathomPriceOracle", getProxyId("FathomPriceOracle"));
  const centralizedOraclePriceFeed = await getProxyById(proxyFactory, "CentralizedOraclePriceFeed", getProxyId("CentralizedOraclePriceFeed"));

  const newAddresses = {
    fathomPriceOracle: fathomPriceOracle.address,
    collateralTokenAdapter: collateralTokenAdapter.address,
    centralizedOraclePriceFeed: centralizedOraclePriceFeed.address,
  };

  await collateralTokenAdapter.initialize(bookKeeper.address, poolId, config.tokenAddress, proxyWalletFactory.address);
  // await fathomPriceOracle.initialize(accessControlConfig.address, config.fathomOracle),
  await centralizedOraclePriceFeed.initialize(fathomPriceOracle.address, accessControlConfig.address, poolId);
  fs.writeFileSync(`./addresses_${token}.json`, JSON.stringify(newAddresses));
}
module.exports = { initialize };
