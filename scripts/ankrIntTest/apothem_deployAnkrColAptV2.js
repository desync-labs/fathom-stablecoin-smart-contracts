
const AnkrCollateralAdapterV2 = artifacts.require('AnkrCollateralAdapterV2.sol');

module.exports =  async function(deployer) {

  // console.log(AnkrCollateralAdapterV2);
  console.log(">> Deploying an implementation of AnkrCollateralAdapterV2")
  let promises = [
      deployer.deploy(AnkrCollateralAdapterV2, { gas: 7050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('AnkrCollateralAdapterV2.sol');
  console.log("AnkrCollateralAdapterV2's implementation is deployed at " + deployed.address);

};