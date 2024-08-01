const MFXD = artifacts.require('MultichainFXD.sol');
const { BigNumber } = require("ethers");

module.exports = async function (deployer) {

  const initializerLibSepolia = "0xa84b4464989e76b193d33fD65807F80BBD004A8a";

  const initializerLibBSCTest = "0xE412121479211c3e9c50EC940F50596f293c08F0";
  const initializerLibFantomTest = "0x372824586fEe6388208D55021D6eeaE9f88d636B";
  const initializerLibApothem = "0x368249858eCBf9B7af5e5B18731f5d1769071BBB";
  const initialSupply = BigNumber.from("10000000000000000000000000000");

  await deployer.deploy(MFXD, initializerLibSepolia, initialSupply, { gas: 8000000 });

  const multichainFXD = await artifacts.initializeInterfaceAt("MultichainFXD", "MultichainFXD");

  console.log("multichainFXD address is : " + multichainFXD.address)

};