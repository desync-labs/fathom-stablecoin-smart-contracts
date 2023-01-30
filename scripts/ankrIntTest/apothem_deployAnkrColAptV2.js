
const AnkrCollateralAdapterV2 = artifacts.require('./main/stablecoin-core/adapters/FarmableTokenAdapter/AnkrCollateralAdapterV2.sol');

module.exports =  async function(deployer) {

  console.log(">> Deploying an implementation of AnkrCollateralAdapterV2")
  let promises = [
      deployer.deploy(AnkrCollateralAdapterV2, { gas: 3050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./main/stablecoin-core/adapters/FarmableTokenAdapter/AnkrCollateralAdapterV2.sol');
  console.log("AnkrCollateralAdapterV2's implementation is deployed at " + deployed.address);

};