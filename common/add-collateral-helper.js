const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const { formatBytes32String } = ethers.utils;

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
  return config[chainId];
}

function usePlugin(chainId) {
  return config[chainId].usePluginOracle;
}

function getProxyId(contract) {
  return formatBytes32String(`${contract}_${token}`);
}

module.exports = { getConfig, usePlugin, getProxyId, token, poolId };
