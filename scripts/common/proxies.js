
const { formatBytes32String } = require("ethers/lib/utils");

async function getProxy(proxyFactory, contract) {
    const address = await proxyFactory.proxies(formatBytes32String(contract));
    return await artifacts.initializeInterfaceAt(contract, address);
}

async function getProxyById(proxyFactory, contract, proxyId) {
    const address = await proxyFactory.proxies(proxyId);
    return await artifacts.initializeInterfaceAt(contract, address);
}

module.exports = { getProxy, getProxyById }