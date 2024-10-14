const fs = require("fs");
const path = require("path");

const externalTransferOwnershipPath = path.resolve(__dirname, "..", "op-config", "transferProtocolOwnership.json");
let config;
try {
  const rawdata = fs.readFileSync(externalTransferOwnershipPath, "utf8");
  config = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing transferProtocolOwnership.json: ${error.message}`);
  config = {};
}

function getConfig(chainId) {
  let chainConfig = config[chainId];
  return chainConfig;
}

module.exports = { getConfig };
