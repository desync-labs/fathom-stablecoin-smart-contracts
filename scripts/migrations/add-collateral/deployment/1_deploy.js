const FathomPriceOracle = artifacts.require('FathomPriceOracle.sol');
const CollateralTokenAdapter = artifacts.require('CollateralTokenAdapter.sol');
const CentralizedOraclePriceFeed = artifacts.require('CentralizedOraclePriceFeed.sol');

const SimplePriceFeedNewCol = artifacts.require('SimplePriceFeedNewCol.sol');

module.exports = async function (deployer) {
  let promises = [
    deployer.deploy(CollateralTokenAdapter, { gas: 7050000 }),
    deployer.deploy(FathomPriceOracle, { gas: 7050000 }),

    deployer.deploy(CentralizedOraclePriceFeed, { gas: 7050000 }),
    deployer.deploy(SimplePriceFeedNewCol, { gas: 7050000 }),
  ];

  await Promise.all(promises);
};