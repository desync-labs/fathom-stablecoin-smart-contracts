const { ethers } = require("hardhat");
const { getConfig, getProxyId } = require("../../../common/add-collateral-helper");

async function deployProxies(deployments, getChainId, forFixture = false) {
  const chainId = await getChainId();
  const config = getConfig(chainId);

  let proxyFactoryAddress, proxyAdminAddress;
  if (forFixture) {
    const ProxyFactory = await deployments.get("FathomProxyFactory");
    const ProxyAdmin = await deployments.get("FathomProxyAdmin");
    proxyFactoryAddress = ProxyFactory.address;
    proxyAdminAddress = ProxyAdmin.address;
  } else {
    proxyFactoryAddress = config.fathomProxyFactory;
    proxyAdminAddress = config.fathomProxyAdmin;
  }

  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", proxyFactoryAddress);
  const proxyAdmin = await ethers.getContractAt("FathomProxyAdmin", proxyAdminAddress);

  const contracts = ["DelayFathomOraclePriceFeed", "DexPriceOracle", "CollateralTokenAdapter", "SlidingWindowDexOracle"];

  await Promise.all(
    contracts.map(async (contract) => {
      const instance = await deployments.get(contract);
      return proxyFactory.createProxy(getProxyId(contract), instance.address, proxyAdmin.address, "0x");
    })
  );
}
module.exports = { deployProxies };