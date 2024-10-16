const fs = require("fs");
const path = require("path");

const initialCollateralSetUpPath = path.resolve(__dirname, "..", "op-config/initialCollateralSetUp.json");
const newCollateralSetupPath = path.resolve(__dirname, "..", "op-config/newCollateralSetup.json");

let config;
try {
  const rawdata = fs.readFileSync(initialCollateralSetUpPath, "utf8");
  config = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing initialCollateralSetUp.json: ${error.message}`);
  config = {};
}

let config2;
try {
  const rawdata = fs.readFileSync(newCollateralSetupPath, "utf8");
  config2 = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing newCollateralSetup.json: ${error.message}`);
  config2 = {};
}

function getConfigInitialCollateral(chainId) {
  let chainConfig = config[chainId];
  return chainConfig;
}

function getConfigAddCollateral(chainId) {
  let chainConfigNewCollateral = config2[chainId];
  return chainConfigNewCollateral;
}

module.exports = {
  getConfigInitialCollateral,
  getConfigAddCollateral,
};
