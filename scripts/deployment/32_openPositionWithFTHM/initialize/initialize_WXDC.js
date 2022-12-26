const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { BigNumber } = require("ethers");
// for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

// for ganache
const devAddress = "0x0CF4bC892112518f96506Df151185d0F572CfF5f";

const FTHM = artifacts.require('./tests/mocks/FTHM.sol');

// ApothemV1
const FTHMAddress = "0x4c52500DdC18EE0C6CB6155961347076E43ABb99";

module.exports =  async function(deployer) {
  console.log(">> Minting FTHM")

  const FTHMInstance = await FTHM.at(FTHMAddress);
  // const WXDCInstance = await FTHM.at(stablecoinAddress.FTHM);

  //mint to V1 faucet
  await FTHMInstance.mint(
    "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0", BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 }
  )

  // const balanceFaucet = await WXDCInstance.balanceOf("0x5ec5B77C512fBd7A32b8fb6aE78a5cFbB500eb2b");
  // console.log("balanceFaucetWXDC is " + balanceFaucet);


};