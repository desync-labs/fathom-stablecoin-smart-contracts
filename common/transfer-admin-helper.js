const fs = require("fs");
const path = require("path");

const externalTransferAdminPath = path.resolve(__dirname, "..", "op-config", "transferProxyAdminOwnership.json");
let config;
try {
  const rawdata = fs.readFileSync(externalTransferAdminPath, "utf8");
  config = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing transferProxyAdminOwnership.json: ${error.message}`);
  config = {};
}

function getConfig(chainId) {
  let chainConfig = config[chainId];
  return chainConfig;
}

module.exports = { getConfig };
