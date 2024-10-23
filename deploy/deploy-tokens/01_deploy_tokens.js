const { ethers } = require("hardhat");
const { BigNumber } = ethers;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("WXDC", {
    contract: "ERC20Mintable",
    from: deployer,
    log: true,
    args: ["WXDC", "WXDC"],
  });
  await deploy("USDT", {
    contract: "ERC20Mintable",
    from: deployer,
    log: true,
    args: ["USDT", "USDT"],
  });
  await deploy("FTHM", {
    contract: "ERC20Mintable",
    from: deployer,
    log: true,
    args: ["FTHM", "FTHM"],
  });

  const WXDC = await deployments.get("WXDC");
  const wxdc = await ethers.getContractAt("ERC20Mintable", WXDC.address);
  const USDT = await deployments.get("USDT");
  const usdt = await ethers.getContractAt("ERC20Mintable", USDT.address);
  const FTHM = await deployments.get("FTHM");
  const fthm = await ethers.getContractAt("ERC20Mintable", FTHM.address);

  await wxdc.mint(deployer, BigNumber.from("10000000000000000000000000000"));
  await usdt.mint(deployer, BigNumber.from("10000000000000000000000000000"));
  await fthm.mint(deployer, BigNumber.from("10000000000000000000000000000"));
};

module.exports.tags = ["DeployTokens"];