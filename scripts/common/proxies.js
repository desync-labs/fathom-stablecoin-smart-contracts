
const { formatBytes32String } = require("ethers/lib/utils");

async function getProxy(proxyFactory, contract) {
    const address = await proxyFactory.proxies(formatBytes32String(contract));
    return await artifacts.initializeInterfaceAt(contract, address);
}

module.exports = { getProxy }