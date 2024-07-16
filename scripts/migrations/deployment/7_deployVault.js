const Vault = artifacts.require('Vault.sol');
const { getAddresses } = require("../../common/addresses");
const { getProxy } = require("../../common/proxies");
const pools = require("../../common/collateral");


module.exports =  async function(deployer) {
  const addresses = getAddresses(deployer.networkId())
  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

  let promises = [
      deployer.deploy(Vault, pools.XDC, addresses.WXDC, collateralTokenAdapter.address, { gas: 7050000 }),
  ];

  await Promise.all(promises);
};