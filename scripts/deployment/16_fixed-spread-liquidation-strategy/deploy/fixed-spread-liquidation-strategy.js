const fs = require('fs');

const FixedSpreadLiquidationStrategy = artifacts.require('./8.17/stablecoin-core/liquidation-strategies/FixedSpreadLiquidationStrategy.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable FixedSpreadLiquidationStrategy contract")
  let promises = [
      deployer.deploy(FixedSpreadLiquidationStrategy, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed= artifacts.require('./8.17/stablecoin-core/liquidation-strategies/FixedSpreadLiquidationStrategy.sol');

  let addressesUpdate = { 
    fixedSpreadLiquidationStrategy: deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};