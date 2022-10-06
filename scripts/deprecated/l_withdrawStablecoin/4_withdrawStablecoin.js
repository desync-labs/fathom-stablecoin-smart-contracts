const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");

const WeiPerWad = hre.ethers.constants.WeiPerEther

const ProxyWalletArtifact = require("../../artifacts/contracts/6.12/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

let rawdata = fs.readFileSync('./scripts/l_withdrawStablecoin/cupcakes/0_deployment.json');
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

const stablecoinAdapterJSON = {
    address : addresses.stablecoinAdapter
}

const stabilityFeeCollectorJSON = {
    address : addresses.stabilityFeeCollector
}

const fathomStablecoinJSON = {
    address : addresses.fathomStablecoin
}

let proxyWalletsData = fs.readFileSync('./scripts/l_withdrawStablecoin/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(proxyWalletsData);

const proxyWalletAlice = proxyWallets.proxyWalletAlice;
const proxyWalletAbi = ProxyWalletArtifact.abi;

let positionsData = fs.readFileSync('./scripts/l_withdrawStablecoin/cupcakes/3_positionHandlerAddresses.json');
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

    //Position Manager attach
    const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
    const fathomStablecoin = await FathomStablecoin.attach(
        fathomStablecoinJSON.address // The deployed contract address
    )

    const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAlice, proxyWalletAbi, walletAlice);

    await printStablecoinBalances(fathomStablecoin, bookKeeper);

    // stablecoin will be minted and moved to position address inside the draw function
    // difference between moveStablecoin and withdrawStablecoin that withdrawStablecoin will adjust position to 
    await withdrawStablecoin(AliceAddress, proxyWalletAsAlice, WeiPerWad, 1);

    await printStablecoinBalances(fathomStablecoin, bookKeeper);
}

async function printStablecoinBalances(fathomStablecoin, bookKeeper) {
    const balance = await fathomStablecoin.balanceOf(AliceAddress);
    const positionBalanceInBookKeeper = await bookKeeper.stablecoin(AlicePosition.address)
    const position = await bookKeeper.positions(COLLATERAL_POOL_ID, AlicePosition.address)

    console.log("debt share : "+ position.debtShare)
    console.log("position balance in BookKeeper : " + positionBalanceInBookKeeper)
    console.log("Alice stablecoin balance : " + balance);
}

async function withdrawStablecoin(address, proxyWalletAs, amount, positionId) {
    let drawTokenAbi = [
        "function draw(address _manager, address _stabilityFeeCollector, address _tokenAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _amount, bytes calldata _data)"
    ];

    const encodedAddress = hre.ethers.utils.defaultAbiCoder.encode(["address"], [address]);

    let drawTokenIFace = new hre.ethers.utils.Interface(drawTokenAbi);
    let drawTokenCall = drawTokenIFace.encodeFunctionData("draw", [
        positionManagerJSON.address,
        stabilityFeeCollectorJSON.address,
        collateralTokenAdapterJSON.address,
        stablecoinAdapterJSON.address,
        positionId,
        amount,
        encodedAddress
    ]);

    const tx = await proxyWalletAs.execute2(fathomStablecoinProxyActions.address, drawTokenCall);
    console.log(amount + " stablecoin was withdrawn");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
