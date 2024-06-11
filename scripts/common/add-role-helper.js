const fs = require('fs');
const { formatBytes32String, solidityKeccak256 } = require("ethers/lib/utils");
const ZeroAddress = "0x0000000000000000000000000000000000000000"

const rawdata = fs.readFileSync('../../addRoles.json');
const config = JSON.parse(rawdata);

function getConfig(chainId)  {
    let chainConfig = config[chainId];
    return chainConfig;
}

function getRolesInBytes32(role) {
    return solidityKeccak256(["string"], [role]);
}

module.exports = { getConfig, getRolesInBytes32 }