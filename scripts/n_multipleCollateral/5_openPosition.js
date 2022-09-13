const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { formatBytes32String } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");
const ProxyWalletArtifact = require("../../artifacts/contracts/6.12/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");
const BEP20Artifact = require("../../artifacts/contracts/6.12/mocks/BEP20.sol/BEP20.json");

const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)

const COLLATERAL_POOL_ID_WXDC = formatBytes32String("WXDC")
const COLLATERAL_POOL_ID_WETH = formatBytes32String("WETH")

const privateKey2 = process.env.PRIVATE_KEY2;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletAlice = new hre.ethers.Wallet(privateKey2,provider);

// Alice address
const AliceAddress = walletAlice.address;

var positionCounter = 0;

let rawdata = fs.readFileSync('./scripts/n_multipleCollateral/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const WXDCJSON = {
  address : addresses.WXDC
}

const WETHJSON = {
  address : addresses.WETH
}

const positionManagerJSON = {
  address : addresses.positionManager
}

const stabilityFeeCollector = {
  address : addresses.stabilityFeeCollector
}

const collateralTokenAdapterWETH = {
  address : addresses.collateralTokenAdapterWETH
}

const collateralTokenAdapterWXDC = {
  address : addresses.collateralTokenAdapterWXDC
}

const stablecoinAdapter = {
  address : addresses.stablecoinAdapter
}

const fathomStablecoinProxyActions = {
  address : addresses.fathomStablecoinProxyActions
}

const bookKeeperJSON = {
  address : addresses.bookKeeper
}

const fathomStablecoinJSON = {
  address : addresses.fathomStablecoin
}

let rawdata2 = fs.readFileSync('./scripts/n_multipleCollateral/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(rawdata2);

const proxyWalletAlice = proxyWallets.proxyWalletAlice;
const proxyWalletAbi = ProxyWalletArtifact.abi;

async function main() {
  //BookKeeper attach
  const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
  const bookKeeper = await BookKeeper.attach(
    bookKeeperJSON.address // The deployed contract address
  )

  //Position Manager attach
  const PositionManager = await hre.ethers.getContractFactory("PositionManager");
  const positionManager = await PositionManager.attach(
    positionManagerJSON.address // The deployed contract address
  )

  //Position Manager attach
  const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
  const fathomStablecoin = await FathomStablecoin.attach(
    fathomStablecoinJSON.address // The deployed contract address
  )

  // WXDC as signers
  const BEP20Abi = BEP20Artifact.abi;
  const WXDCAsAlice = new hre.ethers.Contract(WXDCJSON.address, BEP20Abi, walletAlice);
  const WETHAsAlice = new hre.ethers.Contract(WETHJSON.address, BEP20Abi, walletAlice);

  // proxyWallet as signers
  const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAlice, proxyWalletAbi, walletAlice);

  //Approve
  await WXDCAsAlice.approve(proxyWalletAlice, WeiPerWad.mul(10000));
  await WETHAsAlice.approve(proxyWalletAlice, WeiPerWad.mul(10000));

  // 2. Open a position as Alice, and open a position as Bob
  const aliceFirstPositionAddress = await openPosition(AliceAddress, proxyWalletAsAlice, collateralTokenAdapterWXDC.address, COLLATERAL_POOL_ID_WXDC);
  console.log("Position with WXDC as collateral was opened for Alice");

  // 2. Open a position as Alice, and open a position as Bob
  const aliceSecondPositionAddress = await openPosition(AliceAddress, proxyWalletAsAlice, collateralTokenAdapterWETH.address, COLLATERAL_POOL_ID_WETH);
  console.log("Position with WETh as collateral was opened for Alice");

  let positionHandlerAddresses = { 
    aliceFirstPositionAddress: aliceFirstPositionAddress,
    aliceSecondPositionAddress: aliceSecondPositionAddress
  };

  let data = JSON.stringify(positionHandlerAddresses);
  fs.writeFileSync('./scripts/n_multipleCollateral/cupcakes/3_positionHandlerAddresses.json', data);

  /// functions
  async function openPosition(address, proxyWalletAs, collateralTokenAdapter, collateralPoolId) {
    positionCounter++;
    // https://github.com/ethers-io/ethers.js/issues/478
    let openLockTokenAndDrawAbi = [
      "function openLockTokenAndDraw(address _manager, address _stabilityFeeCollector, address _tokenAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _collateralAmount, uint256 _stablecoinAmount, bool _transferFrom, bytes calldata _data)"
    ];
    let openLockTokenAndDrawIFace = new hre.ethers.utils.Interface(openLockTokenAndDrawAbi);
    const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(["address"], [address]);

    let openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockTokenAndDraw", [
      positionManager.address,
      stabilityFeeCollector.address,
      collateralTokenAdapter,
      stablecoinAdapter.address,
      collateralPoolId,
      WeiPerWad,
      WeiPerWad.mul(65),
      true,
      encodedResult,
    ]);

    const positionId = await proxyWalletAs.execute2(fathomStablecoinProxyActions.address, openPositionCall);
    const positionAddress = await positionManager.positions(positionCounter)
    console.log(`Position Handler's address for positionId ${positionCounter} `+positionAddress)
    const fathomStablecoinBalance = await fathomStablecoin.balanceOf(address)
    console.log("Alice stablecoin balance : " + fathomStablecoinBalance) 
    const position = await bookKeeper.positions(collateralPoolId, positionAddress)
    console.log("lockedCollateral " + position.lockedCollateral)
    console.log("debtShare " + position.debtShare)
    return positionAddress;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
