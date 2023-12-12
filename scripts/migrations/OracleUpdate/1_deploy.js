const FathomPriceOracle = artifacts.require('FathomPriceOracle.sol');

module.exports = async function (deployer) {
  let promises = [
    deployer.deploy(FathomPriceOracle, { gas: 7050000 }),
  ];

  await Promise.all(promises);

  console.log(" FathomPriceOracle implementationaddress is " + FathomPriceOracle.address);
};