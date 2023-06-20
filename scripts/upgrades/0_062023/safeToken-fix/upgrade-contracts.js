const FlashMintModule = artifacts.require('FlashMintModule.sol');
const FlashLoanReceiverBase = artifacts.require('FlashLoanReceiverBase.sol');
const CollateralTokenAdapter = artifacts.require('CollateralTokenAdapter.sol');
const FixedSpreadLiquidationStrategy = artifacts.require('FixedSpreadLiquidationStrategy.sol');
const BookKeeperFlashMintArbitrager = artifacts.require('BookKeeperFlashMintArbitrager.sol');
const FlashMintArbitrager = artifacts.require('FlashMintArbitrager.sol');
const StableSwapModuleWrapper = artifacts.require('StableSwapModuleWrapper.sol');
const { getProxy } = require("../../../common/proxies");

const proxyAdminAddress = "0xcdF2E9a34D7DEe01cbA8420C414737b605256871"
const proxyFactoryAddress = "0x6890D41e4F70829238F5071B55974e1A8F615d31"

module.exports =  async function(deployer) { 
    let promises = [
        deployer.deploy(FlashMintModule, { gas: 7050000 }),
        deployer.deploy(FlashLoanReceiverBase, { gas: 7050000 }),
        deployer.deploy(CollateralTokenAdapter, { gas: 7050000 }),
        deployer.deploy(FixedSpreadLiquidationStrategy, { gas: 7050000 }),
        deployer.deploy(BookKeeperFlashMintArbitrager, { gas: 7050000 }),
        deployer.deploy(FlashMintArbitrager, { gas: 7050000 }),
        deployer.deploy(StableSwapModuleWrapper, { gas: 7050000 })
    ];
  
    await Promise.all(promises);

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", proxyFactoryAddress);
    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", proxyAdminAddress);
    
    const flashMintModule = await getProxy(proxyFactory, "FlashMintModule");
    const flashLoanReceiverBase = await getProxy(proxyFactory, "FlashLoanReceiverBase");
    const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
    const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy")
    const bookkeeperFlashMintArbitrager = await getProxy(proxyFactory, "BookKeeperFlashMintArbitrager")
    const flashMintArbitrager = await getProxy(proxyFactory, "FlashMintArbitrager")
    const stableSwapModuleWrapper = await getProxy(proxyFactory, "StableSwapModuleWrapper")

    await proxyAdmin.upgrade(flashMintModule.address, FlashMintModule.address, { gas: 8000000 });
    await proxyAdmin.upgrade(flashLoanReceiverBase.address, FlashLoanReceiverBase.address, { gas: 8000000 });
    await proxyAdmin.upgrade(collateralTokenAdapter.address, CollateralTokenAdapter.address, { gas: 8000000 });
    await proxyAdmin.upgrade(fixedSpreadLiquidationStrategy.address, FixedSpreadLiquidationStrategy.address, { gas: 8000000 });
    await proxyAdmin.upgrade(bookkeeperFlashMintArbitrager.address, BookKeeperFlashMintArbitrager.address, { gas: 8000000 });
    await proxyAdmin.upgrade(flashMintArbitrager.address, FlashMintArbitrager.address, { gas: 8000000 });
    await proxyAdmin.upgrade(stableSwapModuleWrapper.address, StableSwapModuleWrapper.address, { gas: 8000000 });
}