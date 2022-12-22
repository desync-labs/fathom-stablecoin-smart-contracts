const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const AccessControlConfig = artifacts.require('./main/stablecoin-core/config/AccessControlConfig.sol');

module.exports =  async function(deployer) {

  const accessControlConfig = await AccessControlConfig.at(stablecoinAddress.accessControlConfig);

  await accessControlConfig.initialize()
};