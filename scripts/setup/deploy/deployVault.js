const { ethers } = require("hardhat");
const { getAddresses } = require("../../../common/addresses");
const { getProxy } = require("../../../common/proxies");
const pools = require("../../../common/collateral");

async function deployVault(getNamedAccounts, deployments, getChainId, forFixture = false) {
  const chainId = await getChainId();
  const addresses = getAddresses(chainId);
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  let wxdcAddress;
  if (forFixture) {
    const WXDC = await deployments.get("WXDC");
    wxdcAddress = WXDC.address;
  } else {
    wxdcAddress = addresses.WXDC;
  }
  await deploy("Vault", {
    from: deployer,
    args: [pools.XDC, wxdcAddress, collateralTokenAdapter.address],
    log: true,
  });
}

module.exports = {
  deployVault,
};
