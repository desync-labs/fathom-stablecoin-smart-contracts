const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const { formatBytes32String } = ethers.utils;

const ZeroAddress = "0x0000000000000000000000000000000000000000";

const addCollateralPath = path.resolve(__dirname, "..", "add-collateral.json");

let config;
try {
  const rawdata = fs.readFileSync(addCollateralPath, "utf8");
  config = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing add-collateral.json: ${error.message}`);
  config = {};
}
const token = config.token;
const poolId = formatBytes32String(token);

function getConfig(chainId) {
  let chainConfig = config[chainId];
  chainConfig.useFathomOracle = chainConfig.fatomOracle !== undefined && chainConfig.fatomOracle !== ZeroAddress;
  return chainConfig;
}

function getProxyId(contract) {
  return formatBytes32String(`${contract}_${token}`);
}

module.exports = { getConfig, getProxyId, token, poolId };
