const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const GetPositionsV2 = artifacts.require('./8.17/stats/GetPositionsV2.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing GetPositionsV2")

  const getPositionsV2 = await GetPositionsV2.at(stablecoinAddress.getPositionsV2);

  // console.log(stablecoinAddress)

  await getPositionsV2.initialize("0x1D8462D0a5FB28c47d01254e3Cc57B1f67f3DAD5")
};