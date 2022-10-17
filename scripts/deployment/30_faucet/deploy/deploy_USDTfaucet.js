const fs = require('fs');

const Faucet = artifacts.require('./8.17/faucet/Faucet.sol');

const rawdata = fs.readFileSync('../../../../faucets.json');
let stablecoinAddress = JSON.parse(rawdata);

// Apothem V1
const USDT = "0xCcdC0653935A251B6839F30359917977f994b5d9";

module.exports =  async function(deployer) {

  console.log(">> Deploying an USDT Faucet contract")
  let promises = [
      deployer.deploy(Faucet, USDT, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/apis/fathom/FairLaunch.sol');
  let addressesUpdate = { 
    faucetUSDT:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./faucets.json', data);
};