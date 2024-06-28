const fs = require('fs');
const { formatBytes32String } = require("ethers/lib/utils");
const ZeroAddress = "0x0000000000000000000000000000000000000000"

const rawdata = fs.readFileSync('../../setFathomPriceOracle.json');
const config = JSON.parse(rawdata);
const token = config.token;
const poolId = formatBytes32String(token);

function getConfig(chainId)  {
    let chainConfig = config[chainId];
    return chainConfig;
}

function getProxyIdSwitchPriceFeed(contract) {
    return formatBytes32String(`${contract}_${token}`)
}

module.exports = { getConfig, getProxyIdSwitchPriceFeed, token, poolId }