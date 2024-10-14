const fs = require("fs");
const path = require("path");

const externalAddRolesPath = path.resolve(__dirname, "..", "op-config", "addRoles.json");
let config;
try {
  const rawdata = fs.readFileSync(externalAddRolesPath, "utf8");
  config = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing addRoles.json: ${error.message}`);
  config = {};
}

function getConfig(chainId) {
  let chainConfig = config[chainId];
  return chainConfig;
}

module.exports = { getConfig };
