const fs = require('fs');

const FathomStablecoinProxyActions = artifacts.require('./8.17/proxy-actions/FathomStablecoinProxyActions.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an FathomStablecoinProxyActions contract")
  let promises = [
      deployer.deploy(FathomStablecoinProxyActions, { gas: 5050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/proxy-actions/FathomStablecoinProxyActions.sol');
  let addressesUpdate = { 
    fathomStablecoinProxyActions: deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};