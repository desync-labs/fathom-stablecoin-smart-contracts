const { ethers } = require("hardhat");
const { getConfig, getProxyId } = require("../../../common/add-collateral-helper");
async function deployProxies(deployments, getChainId, forFixture = false) {
  const chainId = await getChainId();
  const config = getConfig(chainId);

  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const ProxyAdmin = await deployments.get("FathomProxyAdmin");

  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", forFixture ? ProxyFactory.address : config.fathomProxyFactory);
  const proxyAdmin = await ethers.getContractAt("FathomProxyAdmin", forFixture ? ProxyAdmin.address : config.fathomProxyAdmin);

  const contracts = ["CollateralTokenAdapter", "FathomPriceOracle", "CentralizedOraclePriceFeed"];

  await Promise.all(
    contracts.map(async (contract) => {
      const instance = await deployments.get(contract);
      return proxyFactory.createProxy(getProxyId(contract), instance.address, proxyAdmin.address, "0x");
    })
  );
}
module.exports = { deployProxies };
