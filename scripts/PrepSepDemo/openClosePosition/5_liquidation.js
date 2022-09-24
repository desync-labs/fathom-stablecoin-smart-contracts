const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");
const ProxyWalletArtifact = require("../../../artifacts/contracts/8.17/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");
const WXDCArtifact = require("../../../artifacts/contracts/8.17/mocks/BEP20.sol/BEP20.json");
const StableCoinArtifact = require("../../../artifacts/contracts/8.17/stablecoin-core/FathomStablecoin.sol/FathomStablecoin.json");
const MaxUint256 = require("@ethersproject/constants");
const WeiPerWad = hre.ethers.constants.WeiPerEther

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

const privateKey1 = process.env.PRIVATE_KEY1;
const privateKey2 = process.env.PRIVATE_KEY2;
const privateKey3 = process.env.PRIVATE_KEY3;
const privateKey4 = process.env.PRIVATE_KEY4;



const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletAlice = new hre.ethers.Wallet(privateKey2,provider);
const walletBob = new hre.ethers.Wallet(privateKey3,provider);

// Contract addresses
const AliceAddress = walletAlice.address;
const BobAddress = walletBob.address;

const debtShareToRepay = parseEther("0.5")

var positionCounter = 0;

let rawdata = fs.readFileSync('addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

let rawdata2 = fs.readFileSync('./scripts/PrepSepDemo/openClosePosition/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(rawdata2);

const proxyWalletAlice = proxyWallets.proxyWalletAlice;
const proxyWalletAbi = ProxyWalletArtifact.abi;

let rawdata3 = fs.readFileSync('./scripts/PrepSepDemo/openClosePosition/cupcakes/3_positionHandlerAddresses.json');
let positionAddresses = JSON.parse(rawdata3);

async function main() {

    //BookKeeper attach as Bob
    const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
    const bookKeeperAsBob = await BookKeeper.attach(
        stablecoinAddress.bookKeeper // The deployed contract address
    ).connect(walletBob);

    //Position Manager attach
    const PositionManager = await hre.ethers.getContractFactory("PositionManager");
    const positionManager = await PositionManager.attach(
        stablecoinAddress.positionManager // The deployed contract address
    )

    // Copyright Fathom 2022 stablecoin attach as Alice
    const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
    const fathomStablecoinAsAlice = await FathomStablecoin.attach(
        stablecoinAddress.fathomStablecoin // The deployed contract address
    ).connect(walletAlice);
  
    // SimplePriceFeed attach
    const SimplePriceFeed = await hre.ethers.getContractFactory("SimplePriceFeed");
    const simplePriceFeed = await SimplePriceFeed.attach(stablecoinAddress.simplePriceFeed);

    // PriceOracle attach
    const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.attach(stablecoinAddress.priceOracle);

    // CollateralTokenAdapter attach
    const CollateralTokenAdapter = await hre.ethers.getContractFactory("CollateralTokenAdapter");
    const collateralTokenAdapter = await CollateralTokenAdapter.attach(stablecoinAddress.collateralTokenAdapter);

    //WXDC attach
    const BEP20 = await hre.ethers.getContractFactory("BEP20");
    const WXDC = await BEP20.attach(
        stablecoinAddress.WXDC // The deployed contract address
    )

    //Liquidation Engine attach as Bob

    const LiquidationEngine = await hre.ethers.getContractFactory("LiquidationEngine");
    const liquidationEngineAsBob = await LiquidationEngine.attach(
      stablecoinAddress.liquidationEngine
    ).connect(walletBob);

    // Set up ProxyWalletAsAlice instance
    const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAlice, proxyWalletAbi, walletAlice);
    //Change price
    await simplePriceFeed.setPrice(WeiPerWad.div(2));
    await priceOracle.setPrice(COLLATERAL_POOL_ID);
    //Alice deposits stablecoin to increase internal balance for Bob
    await fathomStablecoinAsAlice.approve(proxyWalletAlice, WeiPerWad.mul(1));
    const AliceBalance = await fathomStablecoinAsAlice.balanceOf(AliceAddress);
    console.log("FathomStablecoin balance of Alice before deposit is " + AliceBalance);
    await stablecoinAdapterDeposit(BobAddress, proxyWalletAsAlice, 1);
    //Bob liquidate's Alice's position, PID is 2
    await bookKeeperAsBob.whitelist(stablecoinAddress.liquidationEngine);
    await bookKeeperAsBob.whitelist(stablecoinAddress.fixedSpreadLiquidationStrategy);
    //Bob liquidates
    await liquidationEngineAsBob.liquidate(COLLATERAL_POOL_ID, positionAddresses.alicePositionAddress2, debtShareToRepay.mul(2), MaxUint256.MaxUint256, BobAddress, "0x00")

    const BobStakedAmountAfterLQ = await collateralTokenAdapter.stake(BobAddress);
    console.log("BobStakedAmountAfter liquidation is : " + BobStakedAmountAfterLQ);

    let SystemDebtEngineCollateralSurplus = await collateralTokenAdapter.stake(stablecoinAddress.systemDebtEngine);
    console.log("SystemDebtEngineCollateralSurplusAfterLiquidation is : " + SystemDebtEngineCollateralSurplus);

    async function stablecoinAdapterDeposit(address, proxyWalletAs, amount) {
      // https://github.com/ethers-io/ethers.js/issues/478
      let stablecoinAdapterDepositAbi = [
        "function stablecoinAdapterDeposit(address _adapter, address _positionAddress, uint256 _stablecoinAmount, bytes calldata _data)"
      ];
      let stablecoinAdapterDepositAbiIFace = new hre.ethers.utils.Interface(stablecoinAdapterDepositAbi);
      const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(["address"], [address]);
      console.log(encodedResult);
      let stablecoinAdapterDepositCall = stablecoinAdapterDepositAbiIFace.encodeFunctionData("stablecoinAdapterDeposit", [
        stablecoinAddress.stablecoinAdapter,
        address,
        WeiPerWad.mul(amount),
        encodedResult,
      ]);
  
      await proxyWalletAs.execute2(stablecoinAddress.fathomStablecoinProxyActions, stablecoinAdapterDepositCall);
    }

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
