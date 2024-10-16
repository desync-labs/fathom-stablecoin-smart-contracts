const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;

const addressesPath = path.resolve(__dirname, "..", "..", "..", "addresses.json");
let addresses;
try {
  const rawdata = fs.readFileSync(addressesPath, "utf8");
  addresses = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing addresses.json: ${error.message}`);
  addresses = {};
}

const addCollateralPath = path.resolve(__dirname, "..", "..", "..", "add-collateral.json");
let addCollateral;
try {
  const rawdata = fs.readFileSync(addCollateralPath, "utf8");
  addCollateral = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing add-collateral.json: ${error.message}`);
  addCollateral = {};
}

const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`);

async function addCollateralPreDeployment(getNamedAccounts, deployments, getChainId) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("ERC20", {
    contract: "ERC20Mintable",
    from: deployer,
    args: ["GLD", "GLD"],
    log: true,
  });
  await deploy("TestOracleMock", {
    from: deployer,
    args: [WeiPerRay],
    log: true,
  });

  const ERC20 = await deployments.get("ERC20");
  const TestOracleMock = await deployments.get("TestOracleMock");

  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const ProxyAdmin = await deployments.get("FathomProxyAdmin");

  const chainId = await getChainId();
  addCollateral[chainId].fathomProxyFactory = ProxyFactory.address;
  addCollateral[chainId].fathomProxyAdmin = ProxyAdmin.address;
  addCollateral[chainId].testOracle = TestOracleMock.address;
  addCollateral[chainId].tokenAddress = ERC20.address;

  await deploy("StableswapMultipleSwapsMock", {
    from: deployer,
    args: [],
    log: true,
  });
  fs.writeFileSync("./add-collateral.json", JSON.stringify(addCollateral));
}

module.exports = {
  addCollateralPreDeployment,
};
