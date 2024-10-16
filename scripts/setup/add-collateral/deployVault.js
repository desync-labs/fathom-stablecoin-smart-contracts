const { ethers } = require("hardhat");
const { formatBytes32String } = ethers.utils;

const { getProxyById } = require("../../../common/proxies");
const { getConfig, getProxyId, token } = require("../../../common/add-collateral-helper");

async function deployVault(getNamedAccounts, deployments, getChainId, forFixture = false) {
  const chainId = await getChainId();
  const config = getConfig(chainId);
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", forFixture ? ProxyFactory.address : config.fathomProxyFactory);
  const collateralTokenAdapter = await getProxyById(proxyFactory, "CollateralTokenAdapter", getProxyId("CollateralTokenAdapter"));

  const ERC20 = await deployments.get("ERC20");
  await deploy("Vault", {
    from: deployer,
    args: [formatBytes32String(token), forFixture ? ERC20.address : config.tokenAddress, collateralTokenAdapter.address],
    log: true,
  });

  const Vault = await deployments.get("Vault");
  await collateralTokenAdapter.setVault(Vault.address);
}
module.exports = { deployVault };
