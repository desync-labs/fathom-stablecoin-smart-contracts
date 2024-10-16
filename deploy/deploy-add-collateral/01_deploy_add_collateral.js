// Setup
const { deploy } = require("../../scripts/setup/add-collateral/deploy");
const { deployProxies } = require("../../scripts/setup/add-collateral/deployProxies");
const { initialize } = require("../../scripts/setup/add-collateral/initialize");
const { addRoles } = require("../../scripts/setup/add-collateral/addRoles");
const { deployVault } = require("../../scripts/setup/add-collateral/deployVault");

// Configuration
const { configPool } = require("../../scripts/configuration/add-collateral/configPool");

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  // Setup
  await deploy(getNamedAccounts, deployments);
  await deployProxies(deployments, getChainId);
  await initialize(getChainId);
  await addRoles(getChainId);
  await deployVault(getNamedAccounts, deployments, getChainId);

  // Configuration
  await configPool(deployments, getChainId);
};

module.exports.tags = ["DeployAddCollateral"];
