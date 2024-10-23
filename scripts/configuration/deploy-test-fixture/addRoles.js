const { ethers } = require("hardhat");

const { getProxy } = require("../../../common/proxies");

async function addRoles(getNamedAccounts, deployments) {
  const { deployer } = await getNamedAccounts();
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

  const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
  const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
  const stableSwap = await getProxy(proxyFactory, "StableSwapModule");
  const stableSwapModuleWrapper = await getProxy(proxyFactory, "StableSwapModuleWrapper");

  await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), deployer);

  await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), deployer);
  await accessControlConfig.grantRole(await accessControlConfig.OWNER_ROLE(), deployer);

  await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), deployer);

  await stableSwap.addToWhitelist(deployer);
  await stableSwapModuleWrapper.addToWhitelist(deployer);
  await stableSwap.setStableSwapWrapper(stableSwapModuleWrapper.address);
}

module.exports = {
  addRoles,
};