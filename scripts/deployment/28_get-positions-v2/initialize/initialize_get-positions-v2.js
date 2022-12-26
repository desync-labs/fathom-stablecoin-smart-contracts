const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const GetPositionsV2 = artifacts.require('./main/stats/GetPositionsV2.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing GetPositionsV2")

  const getPositionsV2 = await GetPositionsV2.at(stablecoinAddress.getPositionsV2);

  // console.log(stablecoinAddress)

  await getPositionsV2.initialize(stablecoinAddress.fathomStats)
};