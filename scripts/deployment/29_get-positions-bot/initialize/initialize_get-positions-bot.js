const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

const GetPositions = artifacts.require('./main/managers/GetPositionsBot.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing GetPositionsBot")

  const getPositions = await GetPositions.at("0xAFD1D51a69e1aA9750fbd93f09c08C2c367c9C64");

  await getPositions.initialize(
  )
};