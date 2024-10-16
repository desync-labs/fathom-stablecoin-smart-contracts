const fs = require("fs");
const path = require("path");

const externalRevokeRolesPath = path.resolve(__dirname, "..", "op-config", "revokeRoles.json");
let config;
try {
  const rawdata = fs.readFileSync(externalRevokeRolesPath, "utf8");
  config = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing revokeRoles.json: ${error.message}`);
  config = {};
}

function getConfig(chainId) {
  let chainConfig = config[chainId];
  return chainConfig;
}

module.exports = { getConfig };
