const fs = require("fs");
const pools = require("../../common/collateral");

const rawdata = fs.readFileSync("../../../addresses.json");
const addresses = JSON.parse(rawdata);

const FathomProxyWalletOwner = artifacts.require("FathomProxyWalletOwner.sol");

const proxyWalletRegistry = addresses.proxyWalletRegistry;
const bookKeeper = addresses.bookKeeper;
const collateralPoolConfig = addresses.collateralPoolConfig;
const fathomStablecoin = addresses.fathomStablecoin;
const positionManager = addresses.positionManager;
const stabilityFeeCollector = addresses.stabilityFeeCollector;
const collateralTokenAdapter = addresses.collateralTokenAdapter;
const stablecoinAdapter = addresses.stablecoinAdapter;

module.exports = async function (deployer) {
  let promises = [
    deployer.deploy(
      FathomProxyWalletOwner,
      proxyWalletRegistry,
      bookKeeper,
      collateralPoolConfig,
      fathomStablecoin,
      positionManager,
      stabilityFeeCollector,
      collateralTokenAdapter,
      stablecoinAdapter,
      pools.XDC,
      { gas: 7050000 }
    ),
  ];
  await Promise.all(promises);
};
