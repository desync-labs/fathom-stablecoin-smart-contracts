const fs = require("fs");
const path = require("path");

const externalAddressesPath = path.resolve(__dirname, "..", "externalAddresses.json");

let addresses;
try {
  const rawdata = fs.readFileSync(externalAddressesPath, "utf8");
  addresses = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing externalAddresses.json: ${error.message}`);
  addresses = {};
}

function getAddresses(chainId) {
  return addresses[chainId];
}

module.exports = { getAddresses };
