const Vault = artifacts.require('Vault.sol');
const { getProxyById } = require("../../../common/proxies");
const { formatBytes32String } = require("ethers/lib/utils");
const { getConfig, getProxyId, token } = require("../../../common/add-collateral-helper")
const { getAddresses } = require("../../../common/addresses");

module.exports = async function (deployer) {
  const config = getConfig(deployer.networkId());
  const addresses = getAddresses(deployer.networkId())

  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", config.fathomProxyFactory);
  const collateralTokenAdapterCGO = await getProxyById(proxyFactory, "CollateralTokenAdapterCGO", getProxyId("CollateralTokenAdapterCGO"));

  await deployer.deploy(Vault, formatBytes32String(token), config.tokenAddress, collateralTokenAdapterCGO.address, { gas: 7050000 });
  await collateralTokenAdapterCGO.setVault(Vault.address);

  console.log("VaultCGO address : " Vault.address);
};