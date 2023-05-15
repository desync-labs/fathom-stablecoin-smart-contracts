const fs = require('fs');
const { formatBytes32String } = require("ethers/lib/utils");

const rawdata = fs.readFileSync('../../add-collateral.json');
const config = JSON.parse(rawdata);
const token = config.token;
const poolId = formatBytes32String(token);

function getConfig(chainId)  {
    return config[chainId];
}

function usePlugin(chainId)  {
    return config[chainId].usePluginOracle;
}

function getProxyId(contract) {
    return formatBytes32String(`${contract}_${token}`)
}

module.exports = { getConfig, usePlugin, getProxyId, token, poolId }