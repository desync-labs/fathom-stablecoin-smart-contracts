const fs = require("fs");
const path = require("path");

const externalWhitelistPath = path.resolve(__dirname, "..", "op-config", "removeFromWL.json");
let config;
try {
  const rawdata = fs.readFileSync(externalWhitelistPath, "utf8");
  config = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing removeFromWL.json: ${error.message}`);
  config = {};
}

function getConfig(chainId) {
  let chainConfig = config[chainId];
  return chainConfig;
}

module.exports = { getConfig };
