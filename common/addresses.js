const fs = require("fs");
const path = require("path");

const Deployer = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204";

// Use path.resolve to get the absolute path of the externalAddresses.json file
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
  return addresses[chainId] || {};
}

module.exports = { getAddresses, Deployer };
