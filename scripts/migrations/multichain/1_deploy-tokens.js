const MFXD = artifacts.require('MultichainFXD.sol');
const { BigNumber } = require("ethers");

module.exports = async function (deployer) {

  const initializerLibSepolia = "0xa84b4464989e76b193d33fD65807F80BBD004A8a";

  const initializerLibBSCTest = "0xE412121479211c3e9c50EC940F50596f293c08F0";
  const initialSupply = BigNumber.from("10000000000000000000000000000");

  await deployer.deploy(MFXD, initializerLibBSCTest, initialSupply, { gas: 5000000 });
  const multichainFXD = await artifacts.initializeInterfaceAt("MultichainFXD", "MultichainFXD");

  console.log("multichainFXD BSCTest: " + multichainFXD.address)

};