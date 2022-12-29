const fs = require('fs');
const { BigNumber } = require("ethers");

const MockaXDCc = artifacts.require('./main/mocks/MockaXDCc.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable MockaXDCc contract")
  let promises = [
    deployer.deploy(MockaXDCc, "aXDCc", "XDCC", BigNumber.from('878076691684207684'), { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./main/mocks/MockaXDCc.sol');
  console.log("mockaXDCc is "+ deployed.address);
  let addressesUpdate = { 
    mockaXDCc : deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};