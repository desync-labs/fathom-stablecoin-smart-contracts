const fs = require('fs');

const Deployer = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204"
const ZeroAddress = "0x0000000000000000000000000000000000000000"

const rawdata = fs.readFileSync('../../externalAddresses.json');
const addresses = JSON.parse(rawdata);

function getAddresses(chainId)  {
    return addresses[chainId]
}

module.exports = { getAddresses, Deployer }