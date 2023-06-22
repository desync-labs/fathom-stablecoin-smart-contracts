const FlashMintModule = artifacts.require('FlashMintModule.sol');
const FlashLoanReceiverBase = artifacts.require('FlashLoanReceiverBase.sol');
const CollateralTokenAdapter = artifacts.require('CollateralTokenAdapter.sol');
const FixedSpreadLiquidationStrategy = artifacts.require('FixedSpreadLiquidationStrategy.sol');
const BookKeeperFlashMintArbitrager = artifacts.require('BookKeeperFlashMintArbitrager.sol');
const FlashMintArbitrager = artifacts.require('FlashMintArbitrager.sol');
const StableSwapModule = artifacts.require('StableSwapModule.sol');
const StableSwapModuleWrapper = artifacts.require('StableSwapModuleWrapper.sol');

const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");
const { getProxy } = require("../common/proxies");

module.exports =  async function(deployer) { 
    let promises = [
        deployer.deploy(FlashMintModule, { gas: 7050000 }),
        deployer.deploy(FlashLoanReceiverBase, { gas: 7050000 }),
        deployer.deploy(CollateralTokenAdapter, { gas: 7050000 }),
        deployer.deploy(FixedSpreadLiquidationStrategy, { gas: 7050000 }),
        deployer.deploy(BookKeeperFlashMintArbitrager, { gas: 7050000 }),
        deployer.deploy(FlashMintArbitrager, { gas: 7050000 }),
        deployer.deploy(StableSwapModule, { gas: 7050000 }),
        deployer.deploy(StableSwapModuleWrapper, { gas: 7050000 })
    ];
  
    await Promise.all(promises);

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);
    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    
    const flashMintModule = await getProxy(proxyFactory, "FlashMintModule");
    const flashLoanReceiverBase = await getProxy(proxyFactory, "FlashLoanReceiverBase");
    const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
    const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy")
    const bookkeeperFlashMintArbitrager = await getProxy(proxyFactory, "BookKeeperFlashMintArbitrager")
    const flashMintArbitrager = await getProxy(proxyFactory, "FlashMintArbitrager")
    const stableSwapModuleWrapper = await getProxy(proxyFactory, "StableSwapModuleWrapper")
    const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule")

    await proxyAdmin.upgrade(flashMintModule.address, FlashMintModule.address, { gas: 8000000 });
    await proxyAdmin.upgrade(flashLoanReceiverBase.address, FlashLoanReceiverBase.address, { gas: 8000000 });
    await proxyAdmin.upgrade(collateralTokenAdapter.address, CollateralTokenAdapter.address, { gas: 8000000 });
    await proxyAdmin.upgrade(fixedSpreadLiquidationStrategy.address, FixedSpreadLiquidationStrategy.address, { gas: 8000000 });
    await proxyAdmin.upgrade(bookkeeperFlashMintArbitrager.address, BookKeeperFlashMintArbitrager.address, { gas: 8000000 });
    await proxyAdmin.upgrade(flashMintArbitrager.address, FlashMintArbitrager.address, { gas: 8000000 });
    await proxyAdmin.upgrade(stableSwapModule.address, StableSwapModule.address, { gas: 8000000 });
    await proxyAdmin.upgrade(stableSwapModuleWrapper.address, StableSwapModuleWrapper.address, { gas: 8000000 });
}