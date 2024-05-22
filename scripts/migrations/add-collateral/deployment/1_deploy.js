
const FathomPriceOracleCGO = artifacts.require('FathomPriceOracleCGO.sol');
const CollateralTokenAdapterCGO = artifacts.require('CollateralTokenAdapterCGO.sol');
const CentralizedOraclePriceFeedCGO = artifacts.require('CentralizedOraclePriceFeedCGO.sol');
const SimplePriceFeedCGO = artifacts.require('SimplePriceFeedCGO.sol');

module.exports = async function (deployer) {
  let promises = [
    deployer.deploy(CollateralTokenAdapterCGO, { gas: 7050000 }),
    deployer.deploy(FathomPriceOracleCGO, { gas: 7050000 }),
    deployer.deploy(CentralizedOraclePriceFeedCGO, { gas: 7050000 }),
    deployer.deploy(SimplePriceFeedCGO, { gas: 7050000 }),
  ];

  await Promise.all(promises);
};