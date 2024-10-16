const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");

const deployFixtures = async () => {
  const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");

  const mockedBookKeeper = await smock.fake("BookKeeper");
  const mockedToken = await smock.fake("ERC20Mintable");

  mockedToken.decimals.returns(18);
  mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);

  const StablecoinAdapterFactory = await ethers.getContractFactory("MockStablecoinAdapter");
  const stablecoinAdapter = await StablecoinAdapterFactory.deploy();
  await stablecoinAdapter.deployed();

  await stablecoinAdapter.initialize(mockedBookKeeper.address, mockedToken.address);

  return {
    stablecoinAdapter,
    mockedBookKeeper,
    mockedToken,
    mockedCollateralPoolConfig,
  };
};

module.exports = {
  deployFixtures,
};
