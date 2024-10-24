const { ethers } = require("hardhat");
const { getProxy } = require("../../../common/proxies");

async function configFlashLending(deployments) {
  const { log } = deployments;
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

  const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");

  await fixedSpreadLiquidationStrategy.setFlashLendingEnabled(true);

  log("Contracts Deployed!");
  log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  log("You are deploying to a local network, you'll need a local network running to interact");
  log("Please run `npx hardhat console` to interact with the deployed smart contracts!");
  log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
}

module.exports = {
  configFlashLending,
};
