const { ethers } = require("hardhat");
const { getConfig, getProxyId } = require("../../../common/add-collateral-helper");

async function deployProxies(deployments, getChainId) {
  const chainId = await getChainId();
  const config = getConfig(chainId);

  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", config.fathomProxyFactory);
  const proxyAdmin = await ethers.getContractAt("FathomProxyAdmin", config.fathomProxyAdmin);

  const contracts = ["CollateralTokenAdapter", "FathomPriceOracle", "CentralizedOraclePriceFeed"];

  await Promise.all(
    contracts.map(async (contract) => {
      const instance = await deployments.get(contract);
      return proxyFactory.createProxy(getProxyId(contract), instance.address, proxyAdmin.address, "0x");
    })
  );
}
module.exports = { deployProxies };
