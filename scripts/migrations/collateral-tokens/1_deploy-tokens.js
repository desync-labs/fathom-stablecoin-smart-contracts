const ERC20 = artifacts.require('ERC20Mintable.sol');
const { BigNumber } = require("ethers");

const addresses = require("../../common/addresses");

module.exports = async function (deployer) {

  await deployer.deploy(ERC20, "WNATIVE", "WNATIVE", { gas: 3050000 });
  const wnative = await artifacts.initializeInterfaceAt("ERC20Mintable", "ERC20Mintable");
  await deployer.deploy(ERC20, "USDT", "USDT", { gas: 3050000 });
  const usdc = await artifacts.initializeInterfaceAt("ERC20Mintable", "ERC20Mintable");
  await deployer.deploy(ERC20, "FTHM", "FTHM", { gas: 3050000 });
  const fthm = await artifacts.initializeInterfaceAt("ERC20Mintable", "ERC20Mintable");

  await wnative.mint(addresses.Deployer, BigNumber.from("10000000000000000000000000000"), { gasLimit: 1000000 })
  await usdc.mint(addresses.Deployer, BigNumber.from("10000000000000000000000000000"), { gasLimit: 1000000 })
  await fthm.mint(addresses.Deployer, BigNumber.from("10000000000000000000000000000"), { gasLimit: 1000000 })

  console.log("WNATIVE: " + wnative.address)
  console.log("USDT: " + usdc.address)
  console.log("FTHM: " + fthm.address)
};