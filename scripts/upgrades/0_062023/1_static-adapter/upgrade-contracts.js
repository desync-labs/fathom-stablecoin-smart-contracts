const FathomProxyActions = artifacts.require('FathomStablecoinProxyActions.sol');
const PositionManager = artifacts.require('PositionManager.sol');

const { getProxy } = require("../../../common/proxies");


const proxyAdminAddress = "0xcdF2E9a34D7DEe01cbA8420C414737b605256871"
const proxyFactoryAddress = "0x6890D41e4F70829238F5071B55974e1A8F615d31"

module.exports =  async function(deployer) { 
    let promises = [
        deployer.deploy(FathomProxyActions, { gas: 7050000 }),
        deployer.deploy(PositionManager, { gas: 7050000 })
    ];
  
    await Promise.all(promises);

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", proxyFactoryAddress);
    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", proxyAdminAddress);

    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const proxyActionsStorage = await getProxy(proxyFactory, "ProxyActionsStorage");

    await proxyActionsStorage.setProxyAction(FathomProxyActions.address, { gas: 1000000 });
    await proxyAdmin.upgrade(positionManager.address, PositionManager.address, { gas: 8000000 });
}