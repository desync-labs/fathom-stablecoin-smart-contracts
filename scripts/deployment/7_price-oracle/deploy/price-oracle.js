const fs = require('fs');

const PriceOracle = artifacts.require('./8.17/stablecoin-core/PriceOracle.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable PriceOracle contract")
  let promises = [
      deployer.deploy(PriceOracle, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stablecoin-core/PriceOracle.sol');

  let addressesUpdate = { 
    priceOracle: deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};