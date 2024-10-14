const { ethers } = require("hardhat");
const { getAddresses } = require("../../../common/addresses");
const { getProxy } = require("../../../common/proxies");
const pools = require("../../../common/collateral");

async function deployVault(getNamedAccounts, deployments, getChainId) {
  const chainId = await getChainId();
  const addresses = getAddresses(chainId);
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

  await deploy("Vault", {
    from: deployer,
    args: [pools.NATIVE, addresses.WNATIVE, collateralTokenAdapter.address],
    log: true,
  });
}

module.exports = {
  deployVault,
};
