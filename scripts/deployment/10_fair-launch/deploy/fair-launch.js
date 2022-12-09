const fs = require('fs');

const FairLaunch = artifacts.require('./8.17/apis/fathom/FairLaunch.sol');

const { parseEther } = require("ethers/lib/utils");

const FATHOM_PER_BLOCK = parseEther("100");

// for ganache
// const devAddress = accounts[0];

// for testnet
const devAddress = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

require("dotenv").config();
const WXDCAdd = process.env.WXDC_ADDRESS;
const USDTAdd = process.env.USDT_ADDRESS;
const FTHMAdd = process.env.FTHM_ADDRESS;

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an FairLaunch contract")
  let promises = [
      deployer.deploy(FairLaunch, FTHMAdd, devAddress, FATHOM_PER_BLOCK, 0, 0, 0, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/apis/fathom/FairLaunch.sol');
  let addressesUpdate = { 
    fairLaunch:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};