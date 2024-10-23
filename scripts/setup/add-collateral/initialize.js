const fs = require("fs");
const { ethers } = require("hardhat");

const { getAddresses } = require("../../../common/addresses");
const { getProxy, getProxyById } = require("../../../common/proxies");
const { getConfig, getProxyId, token, poolId } = require("../../../common/add-collateral-helper");

async function initialize(getChainId, forFixture = false) {
  const chainId = await getChainId();
  const config = getConfig(chainId);
  const addresses = getAddresses(chainId);

  let proxyFactoryAddress;
  if (forFixture) {
    const ProxyFactory = await deployments.get("FathomProxyFactory");
    proxyFactoryAddress = ProxyFactory.address;
  } else {
    proxyFactoryAddress = config.fathomProxyFactory;
  }

  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", proxyFactoryAddress);
  const proxyWalletFactory = await getProxy(proxyFactory, "ProxyWalletFactory");
  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");

  const delayFathomOraclePriceFeed = await getProxyById(proxyFactory, "DelayFathomOraclePriceFeed", getProxyId("DelayFathomOraclePriceFeed"));
  const dexPriceOracle = await getProxyById(proxyFactory, "DexPriceOracle", getProxyId("DexPriceOracle"));
  const collateralTokenAdapter = await getProxyById(proxyFactory, "CollateralTokenAdapter", getProxyId("CollateralTokenAdapter"));

  const newAddresses = {
    dexPriceOracle: dexPriceOracle.address,
    collateralTokenAdapter: collateralTokenAdapter.address,
    delayFathomOraclePriceFeed: delayFathomOraclePriceFeed.address,
  };

  let tokenAddress, dexFactoryAddress;
  if (forFixture) {
    const ERC20 = await deployments.get("ERC20");
    const DEXFactory = await deployments.get("DEXFactory");
    tokenAddress = ERC20.address;
    dexFactoryAddress = DEXFactory.address;
  } else {
    tokenAddress = config.tokenAddress;
    dexFactoryAddress = addresses.DEXFactory;
  }

  await dexPriceOracle.initialize(dexFactoryAddress);
  await collateralTokenAdapter.initialize(bookKeeper.address, poolId, tokenAddress, proxyWalletFactory.address);
  // TODO: can we leave adresses.USD as it is?
  delayFathomOraclePriceFeed.initialize(dexPriceOracle.address, tokenAddress, addresses.USD, accessControlConfig.address, poolId);
  fs.writeFileSync(`./addresses_${token}.json`, JSON.stringify(newAddresses));
}
module.exports = { initialize };