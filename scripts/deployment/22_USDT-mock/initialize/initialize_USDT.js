const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

// for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

const systemAccount = accounts[0]; //coralX way of indicating first address

// for ganache
const devAddress = systemAccount;

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
    systemAccount, BigNumber.from("10000000000000000000000000000"), { gasLimit: 1000000 }
  )
  const faucetBalance = await USDTInstance.balanceOf(systemAccount);
  console.log("faucetBalanceUSDT is" + faucetBalance);

};