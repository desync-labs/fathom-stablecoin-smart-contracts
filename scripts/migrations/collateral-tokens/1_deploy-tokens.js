const WXDC = artifacts.require('./8.17/mocks/WXDC.sol');
const USDT = artifacts.require('./8.17/mocks/USDT.sol');
const FTHM = artifacts.require('./8.17/mocks/FTHM.sol');
const { BigNumber } = require("ethers");

const addresses = require("../../common/addresses");

module.exports =  async function(deployer) {
  let promises = [
      deployer.deploy(WXDC, "WXDC", "WXDC", { gas: 3050000 }),
      deployer.deploy(USDT, "USDT", "USDT", { gas: 3050000 }),
      deployer.deploy(FTHM, "FTHM", "FTHM", { gas: 3050000 })
  ];

  await Promise.all(promises);

  const wxdc = await artifacts.initializeInterfaceAt("WXDC", "WXDC");
  const usdc = await artifacts.initializeInterfaceAt("USDT", "USDT");
  const fthm = await artifacts.initializeInterfaceAt("FTHM", "FTHM");

  await wxdc.mint(addresses.Deployer, BigNumber.from("10000000000000000000000000000"), { gasLimit: 1000000 })
  await usdc.mint(addresses.Deployer, BigNumber.from("10000000000000000000000000000"), { gasLimit: 1000000 })
  await fthm.mint(addresses.Deployer, BigNumber.from("10000000000000000000000000000"), { gasLimit: 1000000 })

  console.log(WXDC.address)
  console.log(USDT.address)
  console.log(FTHM.address)
};