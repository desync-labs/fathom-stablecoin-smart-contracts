const { getAddresses } = require("../../../common/addresses");
const { getProxy } = require("../../../common/proxies");
const pools = require("../../../common/collateral");



module.exports =  async function(deployer) {
  const addresses = getAddresses(deployer.networkId())
  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const proxyWalletFactory = await getProxy(proxyFactory, "ProxyWalletFactory");
  const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");
  const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");


  let MockSimplePriceFeed = artifacts.require('MockSimplePriceFeed.sol');
  let MockVault = artifacts.require('MockVault.sol');
  let MockCollateralTokenAdapter = artifacts.require('MockCollateralTokenAdapter.sol');
  let ReentrancyAttacker = artifacts.require("ReentrancyAttacker");
  let ReentrancyAttacker2 = artifacts.require("ReentrancyAttacker2");


  //deploying a mockVault and mockColTokenAdapter to add one more collateral type
  const promises0 = [
      deployer.deploy(MockCollateralTokenAdapter, { gas: 3050000 }),
      deployer.deploy(MockSimplePriceFeed, { gas: 3050000 }),
      deployer.deploy(ReentrancyAttacker, proxyWalletRegistry.address, { gas: 3050000}),
      deployer.deploy(ReentrancyAttacker2, proxyWalletRegistry.address, { gas: 3050000})
  ];

  await Promise.all(promises0);

  MockCollateralTokenAdapter = await artifacts.initializeInterfaceAt("MockCollateralTokenAdapter", "MockCollateralTokenAdapter");
  MockSimplePriceFeed = await artifacts.initializeInterfaceAt("MockSimplePriceFeed", "MockSimplePriceFeed");

  const promises1 = [
    MockCollateralTokenAdapter.initialize(
      bookKeeper.address,
      pools.WNATIVE,
      addresses.WNATIVE,
      positionManager.address,
      proxyWalletFactory.address
  ),
  
    deployer.deploy(MockVault, pools.WNATIVE, addresses.WNATIVE, MockCollateralTokenAdapter.address, { gas: 3050000 }),
  ];

  await Promise.all(promises1);

  MockVault = await artifacts.initializeInterfaceAt("MockVault", "MockVault");
  //giving ADAPTER_ROLE to MockCollateralTokenAdapter
  await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), MockCollateralTokenAdapter.address)

  const promises2 = [
    MockCollateralTokenAdapter.setVault(MockVault.address),
  ];

  await Promise.all(promises2);
};