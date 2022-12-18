const fs = require('fs');

const Faucet = artifacts.require('./main/faucet/Faucet.sol');

// Apothem V1
const WXDC = "0xcEc1609Efd3f12d0Da63250eF6761A7482Dda3BF";

module.exports =  async function(deployer) {

  console.log(">> Deploying an WXDC Faucet contract")
  let promises = [
      deployer.deploy(Faucet, WXDC, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./fair-launch/FairLaunch.sol');
  let addressesUpdate = { 
    faucetWXDC:deployed.address,
  };

  const newAddresses = {
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./faucets.json', data);
};