const fs = require('fs');

const WXDC = artifacts.require('./8.17/mocks/BEP20.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

// for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

// for ganache
const devAddress = "0x0CF4bC892112518f96506Df151185d0F572CfF5f";


module.exports =  async function(deployer) {

  console.log(">> Deploying an FathomToken contract")
  let promises = [
      deployer.deploy(WXDC, "WXDC", "WXDC", { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/mocks/BEP20.sol');

  let addressesUpdate = { 
    WXDC: deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);

  const WXDCInstance = await WXDC.at(stablecoinAddress.WXDC);
  await WXDCInstance.mint()
  await WXDC.mint(await walletDeployer, parseEther("9000000"))
  await WXDC.mint(await devAddress, parseEther("9000000"))
};