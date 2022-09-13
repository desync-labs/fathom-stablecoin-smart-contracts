const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const LiquidationEngineArtifact = require("../../artifacts/contracts/6.12/stablecoin-core/LiquidationEngine.sol/LiquidationEngine.json");
const BookKeeperArtifact = require("../../artifacts/contracts/6.12/stablecoin-core/BookKeeper.sol/BookKeeper.json");
const MaxUint256 = require("@ethersproject/constants");

const COLLATERAL_POOL_ID_WXDC = formatBytes32String("WXDC")
const COLLATERAL_POOL_ID_WETH = formatBytes32String("WETH")

const privateKey3 = process.env.PRIVATE_KEY3;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletBob = new hre.ethers.Wallet(privateKey3,provider);
const BobAddress = walletBob.address;

let rawdata = fs.readFileSync('./scripts/n_multipleCollateral/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const bookKeeperJSON = {
  address : addresses.bookKeeper
}

const fixedSpreadLiquidationStrategy = {
  address : addresses.fixedSpreadLiquidationStrategy
}

const liquidationEngineJSON = {
  address : addresses.liquidationEngine
}

const collateralTokenAdapterWETHJSON = {
  address : addresses.collateralTokenAdapterWETH
}

const collateralTokenAdapterWXDCJSON = {
  address : addresses.collateralTokenAdapterWXDC
}

const systemDebtEngineJSON = {
  address : addresses.systemDebtEngine
}

let rawdata3 = fs.readFileSync('./scripts/n_multipleCollateral/cupcakes/3_positionHandlerAddresses.json');
let positionHandlers = JSON.parse(rawdata3);
const aliceFirstPositionAddress = positionHandlers.aliceFirstPositionAddress
const aliceSecondPositionAddress = positionHandlers.aliceSecondPositionAddress

async function main() {
    //LiquidationEngine attach
    const LiquidationEngine = await hre.ethers.getContractFactory("LiquidationEngine");
    const liquidationEngine = await LiquidationEngine.attach(
      liquidationEngineJSON.address // The deployed contract address
    )

    //BookKeeper attach
    const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
    const bookKeeper = await BookKeeper.attach(
      bookKeeperJSON.address // The deployed contract address
    )

    //CollateralTokenAdapter attach
    const CollateralTokenAdapter = await hre.ethers.getContractFactory("CollateralTokenAdapter");
    const collateralTokenAdapterWETH = CollateralTokenAdapter.attach(
      collateralTokenAdapterWETHJSON.address // The deployed contract address
    )

    const collateralTokenAdapterWXDC = CollateralTokenAdapter.attach(
      collateralTokenAdapterWXDCJSON.address // The deployed contract address
    )

    const debtShareToRepay = parseEther("0.5")
  
    const bookKeeperAbi = BookKeeperArtifact.abi;
    const bookKeeperAsBob = new hre.ethers.Contract(bookKeeper.address, bookKeeperAbi, walletBob);
  
    await bookKeeperAsBob.whitelist(liquidationEngine.address)
    await bookKeeperAsBob.whitelist(fixedSpreadLiquidationStrategy.address)
  
    await printBalances(collateralTokenAdapterWETH, collateralTokenAdapterWXDC);

    // 4. Mint unbackedStablecoin which can be strictly used for liquidation.
    // looking at parseUnits, it is possible to think that it is in RAD
    await bookKeeper.mintUnbackedStablecoin(systemDebtEngineJSON.address, BobAddress, parseUnits("100", 45));
    
    //bob's internal stablecoin amount before liquidation
    const BobInternalStablecoinAmountBFLiquidation = await bookKeeper.stablecoin(BobAddress);
    console.log("BobInternalStablecoinAmountBFLiquidation is "+ BobInternalStablecoinAmountBFLiquidation);

    const liquidationEngineAbi = LiquidationEngineArtifact.abi;
    const liquidationEngineAsBob = new hre.ethers.Contract(liquidationEngine.address, liquidationEngineAbi, walletBob);

    //  Liquidate fully Alice's positions.
    await liquidationEngineAsBob.liquidate(COLLATERAL_POOL_ID_WXDC, aliceFirstPositionAddress, debtShareToRepay.mul(2), MaxUint256.MaxUint256, BobAddress, "0x00")
    console.log("position with WXDC as collateral was liquidated")

    await printBalances(collateralTokenAdapterWETH, collateralTokenAdapterWXDC);

    await liquidationEngineAsBob.liquidate(COLLATERAL_POOL_ID_WETH, aliceSecondPositionAddress, debtShareToRepay.mul(2), MaxUint256.MaxUint256, BobAddress, "0x00")
    console.log("position with WETH as collateral was liquidated")

    await printBalances(collateralTokenAdapterWETH, collateralTokenAdapterWXDC);

    //bob's internal stablecoin amount after liquidation
    const BobInternalStablecoinAmountAFLiquidation = await bookKeeper.stablecoin(BobAddress);
    console.log("BobInternalStablecoinAmountAFLiquidation is "+ BobInternalStablecoinAmountAFLiquidation);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
async function printBalances(collateralTokenAdapterWETH, collateralTokenAdapterWXDC) {
  const BobStakedAmountBeforeLQWETH = await collateralTokenAdapterWETH.stake(BobAddress);
  const BobStakedAmountBeforeLQWXDC = await collateralTokenAdapterWXDC.stake(BobAddress);
  console.log("BobStakedAmount WETH is : " + BobStakedAmountBeforeLQWETH);
  console.log("BobStakedAmount WXDC is : " + BobStakedAmountBeforeLQWXDC);


  let SystemDebtEngineCollateralSurplusWETHBL = await collateralTokenAdapterWETH.stake(systemDebtEngineJSON.address);
  let SystemDebtEngineCollateralSurplusWXDCBL = await collateralTokenAdapterWXDC.stake(systemDebtEngineJSON.address);
  console.log("SystemDebtEngineCollateralSurplusWETH is : " + SystemDebtEngineCollateralSurplusWETHBL);
  console.log("SystemDebtEngineCollateralSurplusWXDC is : " + SystemDebtEngineCollateralSurplusWXDCBL);
}

