const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

const GetPositionsV2 = artifacts.require('./8.17/stats/GetPositionsV2.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing GetPositionsV2")

  const getPositionsV2 = await GetPositionsV2.at("0x75A21c4B05A6eB519A71a9d2266DcBE7d986aF90");

  // console.log(stablecoinAddress)

  await getPositionsV2.initialize("0x88E004Cc69A813c97e0D33B90e1C075eC4495B31")
};