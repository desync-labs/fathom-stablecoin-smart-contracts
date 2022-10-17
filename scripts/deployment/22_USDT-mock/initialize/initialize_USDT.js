const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

// for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

// for ganache
const devAddress = "0x0CF4bC892112518f96506Df151185d0F572CfF5f";

const USDT = artifacts.require('./8.17/mocks/USDT.sol');

// Apothem V1
const USDTAddress = "0xCcdC0653935A251B6839F30359917977f994b5d9";

const { BigNumber } = require("ethers");

module.exports =  async function(deployer) {
  console.log(">> Initializing USDT")

  // const USDTInstance = await USDT.at(stablecoinAddress.USDT);
  const USDTInstance = await USDT.at(USDTAddress);

  // await USDTInstance.mint(
  //   walletDeployer, BigNumber.from("9000000000000000000000000000000000"), { gasLimit: 1000000 }
  // )

  await USDTInstance.mint(
    "0x5ec5B77C512fBd7A32b8fb6aE78a5cFbB500eb2b", BigNumber.from("10000000000000000000000000000"), { gasLimit: 1000000 }
  )
  const faucetBalance = await USDTInstance.balanceOf("0x5ec5B77C512fBd7A32b8fb6aE78a5cFbB500eb2b");
  console.log("faucetBalanceUSDT is" + faucetBalance);

};