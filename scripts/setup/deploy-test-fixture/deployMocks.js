const fs = require("fs");
const path = require("path");

const externalAddressesPath = path.resolve(__dirname, "..", "..", "..", "externalAddresses.json");
let addresses;
try {
  const rawdata = fs.readFileSync(externalAddressesPath, "utf8");
  addresses = JSON.parse(rawdata);
} catch (error) {
  console.error(`Error reading or parsing externalAddresses.json: ${error.message}`);
  addresses = {};
}

async function deployMocks(getNamedAccounts, deployments, getChainId) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("USD", {
    contract: "ERC20Mintable",
    from: deployer,
    args: ["US+", "US+"],
    log: true,
  });
  await deploy("MockedDexRouter", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("TokenAdapter", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("FathomToken", {
    from: deployer,
    args: [88, 89],
    log: true,
  });
  await deploy("ERC20Stable", {
    contract: "ERC20MintableStableSwap",
    from: deployer,
    args: ["StableCoin", "SFC"],
    log: true,
  });
  await deploy("SimplePriceFeed", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("TestOracleMock", {
    from: deployer,
    args: [1000],
    log: true,
  });
  await deploy("MockStablecoinAdapter", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockCollateralPoolConfig", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockFlashMintModule", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockFixedSpreadLiquidationStrategy", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockPositionManager", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockCentralizedOraclePriceFeed", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockDelayFathomOraclePriceFeed", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockDexPriceOracle", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockSlidingWindowDexOracle", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockAdminControls", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockBookKeeper", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockFathomStablecoin", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockLiquidationEngine", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockPriceOracle", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockFathomBridge", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockShowStopper", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockStabilityFeeCollector", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockStableSwapModule", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockStableSwapModuleWrapper", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockSystemDebtEngine", {
    from: deployer,
    args: [],
    log: true,
  });

  const chainId = await getChainId();

  const ERC20 = await deployments.get("USD");
  const ERC20Stable = await deployments.get("ERC20Stable");
  addresses[chainId].USD = ERC20.address;
  addresses[chainId].USDSTABLE = ERC20Stable.address;

  await deploy("WXDC", {
    from: deployer,
    args: [],
    log: true,
  });
  const WXDC = await deployments.get("WXDC");
  const TestOracleMock = await deployments.get("TestOracleMock");
  addresses[chainId].WXDC = WXDC.address;
  addresses[chainId].testOracle = TestOracleMock.address;

  await deploy("StableswapMultipleSwapsMock", {
    from: deployer,
    args: [],
    log: true,
  });
  fs.writeFileSync("./externalAddresses.json", JSON.stringify(addresses));
}

module.exports = {
  deployMocks,
};