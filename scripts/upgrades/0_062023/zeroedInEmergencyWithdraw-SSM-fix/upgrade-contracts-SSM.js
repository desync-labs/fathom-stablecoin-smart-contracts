const StableSwapModule = artifacts.require('StableSwapModule.sol');

const proxyAdminAddress = "0xCE4E8a82BCE85dc8CD7A47C9Ea0bE125f0c5d1B7"
const stableSwapModuleAddress = "0xA090ad1f8EA173128250626a4111B77Fd27a1858"

module.exports =  async function(deployer) { 
    let promises = [
        deployer.deploy(StableSwapModule, { gas: 7050000 }),
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", proxyAdminAddress);
    const stableSwapModule = await artifacts.initializeInterfaceAt("StableSwapModule", stableSwapModuleAddress);

    await proxyAdmin.upgrade(stableSwapModule.address, StableSwapModule.address, { gas: 8000000 })

    await stableSwapModule.udpateTotalValueDeposited()
}