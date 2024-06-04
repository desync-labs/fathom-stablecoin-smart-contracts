const fs = require('fs');
const { formatBytes32String } = require("ethers/lib/utils");
const ZeroAddress = "0x0000000000000000000000000000000000000000"

const rawdata = fs.readFileSync('../../add-collateral.json');
const config = JSON.parse(rawdata);
const token = config.token;
const poolId = formatBytes32String(token);

function getConfig(chainId)  {
    let chainConfig = config[chainId];
    chainConfig.useFathomOracle = chainConfig.fatomOracle !== undefined && chainConfig.fatomOracle !== ZeroAddress;
    return chainConfig;
}

function getProxyId(contract) {
    return formatBytes32String(`${contract}_${token}`)
}

module.exports = { getConfig, getProxyId, token, poolId }