const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");

const WeiPerWad = hre.ethers.constants.WeiPerEther

const ProxyWalletArtifact = require("../../artifacts/contracts/6.12/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

let rawdata = fs.readFileSync('./scripts/m_depositColateral/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const privateKey2 = process.env.PRIVATE_KEY2;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletAlice = new hre.ethers.Wallet(privateKey2,provider);
const AliceAddress = walletAlice.address;

const fathomStablecoinProxyActions = {
    address : addresses.fathomStablecoinProxyActions
}

const positionManagerJSON = {
    address : addresses.positionManager
}

const collateralTokenAdapterJSON = {
    address : addresses.collateralTokenAdapter
}

const bookKeeperJSON = {
    address : addresses.bookKeeper
}

const getPositionsJSON = {
    address : addresses.getPositions
}

let proxyWalletsData = fs.readFileSync('./scripts/m_depositColateral/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(proxyWalletsData);

const proxyWalletAlice = proxyWallets.proxyWalletAlice;
const proxyWalletAbi = ProxyWalletArtifact.abi;

let positionsData = fs.readFileSync('./scripts/m_depositColateral/cupcakes/3_positionHandlerAddresses.json');
let positions = JSON.parse(positionsData);
const AlicePosition = {
    address : positions.aliceFirstPositionAddress
}

async function main() {
    //BookKeeper attach
    const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
    const bookKeeper = await BookKeeper.attach(
        bookKeeperJSON.address // The deployed contract address
    )

    //CollateralPoolConfig attach
    const GetPositions = await hre.ethers.getContractFactory("GetPositions");
    const getPositions = await GetPositions.attach(
        getPositionsJSON.address // The deployed contract address
    )

    const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAlice, proxyWalletAbi, walletAlice);

    await printLog(getPositions, bookKeeper);

    // here we move collateral to position but not lock it
    await depositCollateral(AliceAddress, proxyWalletAsAlice, WeiPerWad);

    await printLog(getPositions, bookKeeper);

    // safety buffer will be increased after we lock deposited collateral
    // function lockToken in proxyActions can do both: deposit collateral token and immediately lock it
    await adjustPosition(proxyWalletAsAlice, 1,    WeiPerWad, 0, AliceAddress);
    console.log("Collateral amount was increased")

    await printLog(getPositions, bookKeeper);
}

async function printLog(getPositions, bookKeeper) {
    const positions = await getPositions.getPositionWithSafetyBuffer(positionManagerJSON.address, 1, 10);
    const position = await bookKeeper.positions(COLLATERAL_POOL_ID, positions._positions[0]);
    console.log("colatteral : " + await bookKeeper.collateralToken(COLLATERAL_POOL_ID, positions._positions[0]));
    console.log("locked colatteral : " + position.lockedCollateral);
    console.log("Safety Buffer : " + positions._safetyBuffers[0]);
}

async function depositCollateral(address, proxyWalletAs, amount) {
    let tokenAdapterDepositAbi = [
        "function tokenAdapterDeposit(address _adapter, address _positionAddress, uint256 _amount, bool _transferFrom, bytes calldata _data)"
    ];
    const encodedAddress = hre.ethers.utils.defaultAbiCoder.encode(["address"], [address]);

    let tokenAdapterDepositIFace = new hre.ethers.utils.Interface(tokenAdapterDepositAbi);
    let tokenAdapterDepositCall = tokenAdapterDepositIFace.encodeFunctionData("tokenAdapterDeposit", [
        collateralTokenAdapterJSON.address,
        AlicePosition.address,
        amount,
        true,
        encodedAddress
    ]);

    const tx = await proxyWalletAs.execute2(fathomStablecoinProxyActions.address, tokenAdapterDepositCall);
    console.log(amount + " collateral was deposited");
}

async function adjustPosition(proxyWallet, positionId, collateralValue, debtShare, address) {
    // https://github.com/ethers-io/ethers.js/issues/478
    let adjustPositionAbi = [
        "function adjustPosition(address _manager, uint256 _positionId, int256 _collateralValue, int256 _debtShare, address _adapter, bytes calldata _data)"
    ];
    let adjustPositionIFace = new hre.ethers.utils.Interface(adjustPositionAbi);
    const encodedData = hre.ethers.utils.defaultAbiCoder.encode(["address"], [address]);
    let adjustPositionCall = adjustPositionIFace.encodeFunctionData("adjustPosition", [
        positionManagerJSON.address,
        positionId,
        collateralValue,
        debtShare,
        collateralTokenAdapterJSON.address,
        encodedData
    ]);
    const movePositionTx = await proxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPositionCall);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
