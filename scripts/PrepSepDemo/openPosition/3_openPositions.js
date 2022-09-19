const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");
const ProxyWalletArtifact = require("../../../artifacts/contracts/8.17/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");
const WXDCArtifact = require("../../../artifacts/contracts/8.17/mocks/BEP20.sol/BEP20.json");

const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

const privateKey1 = process.env.PRIVATE_KEY1;
const privateKey2 = process.env.PRIVATE_KEY2;
const privateKey3 = process.env.PRIVATE_KEY3;
const privateKey4 = process.env.PRIVATE_KEY4;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletAlice = new hre.ethers.Wallet(privateKey2,provider);

// Contract addresses
const AliceAddress = walletAlice.address;

var positionCounter = 0;

let rawdata = fs.readFileSync('addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

let rawdata2 = fs.readFileSync('./scripts/PrepSepDemo/openPosition/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(rawdata2);

const proxyWalletAlice = proxyWallets.proxyWalletAlice;
const proxyWalletBob = proxyWallets.proxyWalletBob;
const proxyWalletAbi = ProxyWalletArtifact.abi;

async function main() {

    //BookKeeper attach
    const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
    const bookKeeper = await BookKeeper.attach(
        stablecoinAddress.bookKeeper // The deployed contract address
    )

    //Position Manager attach
    const PositionManager = await hre.ethers.getContractFactory("PositionManager");
    const positionManager = await PositionManager.attach(
        stablecoinAddress.positionManager // The deployed contract address
    )

    // Copyright Fathom 2022 stablecoin attach
    const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
    const fathomStablecoin = await FathomStablecoin.attach(
        stablecoinAddress.fathomStablecoin // The deployed contract address
    )

    // WXDC as signers
    const WXDCAbi = WXDCArtifact.abi;
    const WXDCAsAlice = new hre.ethers.Contract(stablecoinAddress.WXDC, WXDCAbi, walletAlice);

    // proxyWallet as signers
    const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAlice, proxyWalletAbi, walletAlice);
    
    // 1. price of WXDC was set to 100 in the config script

    //Approve
    await WXDCAsAlice.approve(proxyWalletAlice, WeiPerWad.mul(10000));

    // 2. Open a position as Alice, and open a position as Bob
    const alicePositionAddress = await openPosition(AliceAddress, proxyWalletAlice, proxyWalletAsAlice, "Alice");
    console.log("Position opened for Alice");
    const bobPositionAddress = "0x00"

    let positionHandlerAddresses = { 
        alicePositionAddress: alicePositionAddress,
        bobPositionAddress: bobPositionAddress
    };

    let data = JSON.stringify(positionHandlerAddresses);
    fs.writeFileSync('./scripts/PrepSepDemo/openPosition/cupcakes/3_positionHandlerAddresses.json', data);

    /// functions
    async function openPosition(address, proxyWallet, proxyWalletAs, username) {
        positionCounter++;
        // https://github.com/ethers-io/ethers.js/issues/478
        let openLockTokenAndDrawAbi = [
            "function openLockTokenAndDraw(address _manager, address _stabilityFeeCollector, address _tokenAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _collateralAmount, uint256 _stablecoinAmount, bool _transferFrom, bytes calldata _data)"
        ];
        let openLockTokenAndDrawIFace = new hre.ethers.utils.Interface(openLockTokenAndDrawAbi);
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(["address"], [address]);
        console.log(encodedResult);
        let openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockTokenAndDraw", [
            stablecoinAddress.positionManager,
            stablecoinAddress.stabilityFeeCollector,
            stablecoinAddress.collateralTokenAdapter,
            stablecoinAddress.stablecoinAdapter,
            COLLATERAL_POOL_ID,
            WeiPerWad,
            WeiPerWad,
            true,
            encodedResult,
        ]);

        const positionId = await proxyWalletAs.execute2(stablecoinAddress.fathomStablecoinProxyActions, openPositionCall);
        const positionAddress = await positionManager.positions(positionCounter)
        // const result = await bookKeeper.stablecoin();
        console.log(`Position Handler's address for positionId ${positionCounter} `+positionAddress)
        const fathomStablecoinBalance = await fathomStablecoin.balanceOf(address)
        console.log(username + " stablecoin balance : " + fathomStablecoinBalance) 
        // console.log(username + " stablecoin balance in the book : " + result);
        const position = await bookKeeper.positions(COLLATERAL_POOL_ID, positionAddress)
        // console.log(position.lockedCollateral)
        // console.log(position.debtShare)
        // console.log(await bookKeeper.collateralToken(COLLATERAL_POOL_ID, positionAddress))
        return positionAddress;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
