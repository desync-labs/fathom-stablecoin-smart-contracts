const { ethers } = require("hardhat");
const { getProxy } = require("../../../common/proxies");

async function initCollateralTokenAdapter(deployments) {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

  const Vault = await deployments.get("Vault");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

  await collateralTokenAdapter.setVault(Vault.address);
}

module.exports = {
  initCollateralTokenAdapter,
};