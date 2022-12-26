const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const GetPositions = artifacts.require('./main/managers/GetPositions.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing GetPositions")

  const getPositions = await GetPositions.at("0x7937306b887E05e4fF7BB290a39774cE846E9417");

  await getPositions.initialize(
  )
};