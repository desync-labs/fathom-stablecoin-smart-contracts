const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const GetPositions = artifacts.require('./8.17/managers/GetPositions.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing GetPositions")

  const getPositions = await GetPositions.at(stablecoinAddress.getPositions);

  await getPositions.initialize(
  )
};