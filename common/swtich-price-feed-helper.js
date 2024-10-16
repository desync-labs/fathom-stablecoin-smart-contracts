const fs = require("fs");
const path = require("path");

const externalPriceOraclePath = path.resolve(__dirname, "..", "op-config", "setFathomPriceOracle.json");

let config;
try {
  const rawdata = fs.readFileSync(externalPriceOraclePath, "utf8");
  config = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing setFathomPriceOracle.json: ${error.message}`);
  config = {};
}
const token = config.token;

function getConfig(chainId) {
  let chainConfig = config[chainId];
  return chainConfig;
}

module.exports = { getConfig, token };
