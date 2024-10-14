const fs = require('fs');
const path = require("path");

const externalFeeCollectionPath = path.resolve(__dirname, "..", "op-config", "feeCollection.json");
let config;
try {
  const rawdata = fs.readFileSync(externalFeeCollectionPath, "utf8");
  config = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing feeCollection.json: ${error.message}`);
  config = {};
}

function getConfig(chainId)  {
    let chainConfig = config[chainId];
    return chainConfig;
}

module.exports = { getConfig }