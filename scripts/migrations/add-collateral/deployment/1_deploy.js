const DexPriceOracle = artifacts.require('DexPriceOracle.sol');
const SlidingWindowDexOracle = artifacts.require('SlidingWindowDexOracle.sol');
const DelayFathomOraclePriceFeed = artifacts.require('DelayFathomOraclePriceFeed.sol');
const CollateralTokenAdapter = artifacts.require('CollateralTokenAdapter.sol');
const PluginPriceOracle = artifacts.require('PluginPriceOracle.sol');
const CentralizedOraclePriceFeed = artifacts.require('CentralizedOraclePriceFeed.sol');

const { usePlugin } = require("../../../common/add-collateral-helper")

module.exports = async function (deployer) {
  let promises = [
    deployer.deploy(DexPriceOracle, { gas: 7050000 }),
    deployer.deploy(DelayFathomOraclePriceFeed, { gas: 7050000 }),
    deployer.deploy(CollateralTokenAdapter, { gas: 7050000 }),
    deployer.deploy(SlidingWindowDexOracle, { gas: 7050000 }),
  ];

  if (usePlugin(deployer.networkId())) {
    promises.push(deployer.deploy(PluginPriceOracle, { gas: 7050000 }))
    promises.push(deployer.deploy(CentralizedOraclePriceFeed, { gas: 7050000 }))
  }

  await Promise.all(promises);
};