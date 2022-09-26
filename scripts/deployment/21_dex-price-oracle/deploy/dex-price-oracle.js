const fs = require('fs');

const DexPriceOracle = artifacts.require('./8.17/price-oracles/DexPriceOracle.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
module.exports =  async function(deployer) {

  // const DEX_FACTORY_ADDR = "" //<- please fill in after deploying a DEX smart contract

  //goerli
  const DEX_FACTORY_ADDR = "0xcaef5a76Caa3C7aCe06E5596b0a7c3d1e088c0fe" //

  //Apothem
  // const DEX_FACTORY_ADDR = "0x69310bcBcC35b3d5C2b62C72E75dA68d58FDafC9" //

  console.log(">> Deploying an upgradable DexPriceOracle contract")
  let promises = [
    deployer.deploy(DexPriceOracle, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/price-oracles/DexPriceOracle.sol');

  let addressesUpdate = { 
    dexPriceOracle: deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};