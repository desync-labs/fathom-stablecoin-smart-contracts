const { ethers } = require("hardhat");
const { formatBytes32String } = ethers.utils;

const { getProxyById } = require("../../../common/proxies");
const { getConfig, getProxyId, token } = require("../../../common/add-collateral-helper");

async function deployVault(getNamedAccounts, deployments, getChainId, forFixture = false) {
  const chainId = await getChainId();
  const config = getConfig(chainId);
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  let proxyFactoryAddress;
  if (forFixture) {
    const ProxyFactory = await deployments.get("FathomProxyFactory");
    proxyFactoryAddress = ProxyFactory.address;
  } else {
    proxyFactoryAddress = config.fathomProxyFactory;
  }

  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", proxyFactoryAddress);
  const collateralTokenAdapter = await getProxyById(proxyFactory, "CollateralTokenAdapter", getProxyId("CollateralTokenAdapter"));

  let tokenAddress;
  if (forFixture) {
    const ERC20 = await deployments.get("GLD");
    tokenAddress = ERC20.address;
  } else {
    tokenAddress = config.tokenAddress;
  }
  await deploy("Vault", {
    from: deployer,
    args: [formatBytes32String(token), tokenAddress, collateralTokenAdapter.address],
    log: true,
  });

  const Vault = await deployments.get("Vault");
  await collateralTokenAdapter.setVault(Vault.address);
}
module.exports = { deployVault };