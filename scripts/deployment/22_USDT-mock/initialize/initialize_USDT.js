const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

// for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

// for ganache
const devAddress = "0x0CF4bC892112518f96506Df151185d0F572CfF5f";

const USDT = artifacts.require('./8.17/mocks/USDT.sol');

const { BigNumber } = require("ethers");

module.exports =  async function(deployer) {
  console.log(">> Initializing USDT")

  const USDTInstance = await USDT.at(stablecoinAddress.USDT);


  await USDTInstance.mint(
    walletDeployer, BigNumber.from("10000000000000000000000000"), {from:accounts[0]}
  )

  await USDTInstance.mint(
    devAddress, BigNumber.from("10000000000000000000000000"), {from:accounts[0]}
  )

};