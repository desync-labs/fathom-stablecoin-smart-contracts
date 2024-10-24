const fs = require("fs");
const path = require("path");

const addressesPath = path.resolve(__dirname, "..", "addresses.json");

let addresses;
try {
  const rawdata = fs.readFileSync(addressesPath, "utf8");
  addresses = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing addresses.json: ${error.message}`);
  addresses = {};
}

task("fathom-solidity-sdk", "Fathom Solidity SDK").setAction(async () => {
  const FathomProxyWalletOwner = await ethers.getContractFactory("FathomProxyWalletOwner");

  const proxyWalletRegistry = addresses.proxyWalletRegistry;
  const bookKeeper = addresses.bookKeeper;
  const collateralPoolConfig = addresses.collateralPoolConfig;
  const fathomStablecoin = addresses.fathomStablecoin;
  const positionManager = addresses.positionManager;
  const stabilityFeeCollector = addresses.stabilityFeeCollector;
  const collateralTokenAdapter = addresses.collateralTokenAdapter;
  const stablecoinAdapter = addresses.stablecoinAdapter;

  proxyWalletOwner = await FathomProxyWalletOwner.deploy(
    proxyWalletRegistry,
    bookKeeper,
    collateralPoolConfig,
    fathomStablecoin,
    positionManager,
    stabilityFeeCollector,
    collateralTokenAdapter,
    stablecoinAdapter,
    pools.XDC
  );
  await proxyWalletOwner.deployed();
});

module.exports = {};
