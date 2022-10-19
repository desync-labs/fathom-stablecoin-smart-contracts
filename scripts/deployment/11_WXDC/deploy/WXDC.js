const fs = require('fs');

const WXDC = artifacts.require('./8.17/mocks/WXDC.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an WXDC contract")
  let promises = [
      deployer.deploy(WXDC, "Wrapped XDC", "WXDC", { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/mocks/WXDC.sol');

  let addressesUpdate = { 
    WXDC:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};