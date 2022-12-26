const fs = require('fs');

const FTHM = artifacts.require('./tests/mocks/FTHM.sol');

// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);




module.exports =  async function(deployer) {

  console.log(">> Deploying an FTHM contract")
  let promises = [
      deployer.deploy(FTHM, "FTHM", "FTHM", { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./tests/mocks/WXDC.sol');

  // let addressesUpdate = { 
  //   WXDC:deployed.address,
  // };

  // const newAddresses = {
  //   ...stablecoinAddress,  
  //   ...addressesUpdate
  // };
  console.log("new FTHM is " + deployed.address);

  // let data = JSON.stringify(newAddresses);
  // fs.writeFileSync('./addresses.json', data);
};