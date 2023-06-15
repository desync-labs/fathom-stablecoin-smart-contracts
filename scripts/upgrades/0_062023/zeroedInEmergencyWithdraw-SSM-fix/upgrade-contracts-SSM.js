const StableSwapModule = artifacts.require('StableSwapModule.sol');

const proxyAdminAddress = "0x0000000000000000000000000000000000000000"
const stableSwapModuleAddress = "0x0000000000000000000000000000000000000000"

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