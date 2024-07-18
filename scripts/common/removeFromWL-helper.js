const fs = require('fs');
const { formatBytes32String } = require("ethers/lib/utils");
const ZeroAddress = "0x0000000000000000000000000000000000000000"

const rawdata = fs.readFileSync('../../op-config/removeFromWL.json');
const config = JSON.parse(rawdata);

function getConfig(chainId)  {
    let chainConfig = config[chainId];
    return chainConfig;
}

module.exports = { getConfig }