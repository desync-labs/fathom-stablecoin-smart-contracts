const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

// for testnet
// const devAddress = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";
// for ganache
const devAddress = accounts[0]; //coralX way of indicating first address


const USDT = artifacts.require('./8.17/mocks/USDT.sol');

// Apothem V1
const USDTAddress = "0xCcdC0653935A251B6839F30359917977f994b5d9";

const { BigNumber } = require("ethers");

module.exports =  async function(deployer) {
  console.log(">> Initializing USDT")

  const USDTInstance = await USDT.at(stablecoinAddress.USDT);

  // await USDTInstance.mint(
  //   walletDeployer, BigNumber.from("9000000000000000000000000000000000"), { gasLimit: 1000000 }
  // )

  await USDTInstance.mint(
    devAddress, BigNumber.from("10000000000000000000000000000"), { gasLimit: 1000000 }
  )
  const faucetBalance = await USDTInstance.balanceOf(devAddress);
  console.log("faucetBalanceUSDT is" + faucetBalance);

};