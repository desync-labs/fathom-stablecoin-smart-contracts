const fs = require('fs');

const FTHMProxy = artifacts.require('./main/proxy/FTHMProxy.sol');

const FTHMProxyAdmin = artifacts.require('./main/proxy/FTHMProxyAdmin.sol');

const AccessControlConfig = artifacts.require('./main/stablecoin-core/config/AccessControlConfig.sol');

// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an FTHM proxy admin")
  console.log(">> Deploying an AccessControlConfig")

  let promises = [
      deployer.deploy(FTHMProxyAdmin, { gas: 4050000 }),
      deployer.deploy(AccessControlConfig, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed0 = artifacts.require('./main/proxy/FTHMProxyAdmin.sol');
  const FTHMProxyAdmin_Address = deployed0.address;

  const deployed1 = artifacts.require('./main/stablecoin-core/config/AccessControlConfig.sol');
  const AccessControlConfig_Address = deployed1.address;

  //access control does not have anything in fn initialize()
    promises = [
        deployer.deploy(FTHMProxy, AccessControlConfig_Address, FTHMProxyAdmin_Address, "0x00", { gas: 4050000 }),
    ];

    await Promise.all(promises);

  let addressesUpdate = { 
    FTHMProxyAdmin : FTHMProxyAdmin_Address,
    AccessControlConfig : AccessControlConfig_Address,

  };

  const newAddresses = {
    // ...stablecoinAddress,
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./proxies.json', data);

};