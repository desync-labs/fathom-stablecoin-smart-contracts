const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");
const ProxyWalletArtifact = require("../../../artifacts/contracts/main/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");
const WXDCArtifact = require("../../../artifacts/contracts/main/mocks/BEP20.sol/BEP20.json");

const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

const privateKey1 = process.env.PRIVATE_KEY1;
const url = "https://goerli.infura.io/v3/d85fb151be214d8eaee85c855d9d3dab";
let provider = new ethers.providers.JsonRpcProvider(url);

const walletAlice = new ethers.Wallet(privateKey1,provider);

// Contract addresses
const AliceAddress = walletAlice.address;

var positionCounter = 0;

let rawdata = fs.readFileSync('gorli.json');
let stablecoinAddress = JSON.parse(rawdata);

let rawdata2 = fs.readFileSync('./scripts/gorli_config/openClosePosition/cupcakes/2_proxyWalletAddresses.json');
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

    // 2. Open a position as Alice twice
    const alicePositionAddress1 = await openPosition(AliceAddress, proxyWalletAlice, proxyWalletAsAlice, "Alice");
    console.log("Position1 opened for Alice");
    const bobPositionAddress = "0x00"
    const alicePositionAddress2 = await openPosition(AliceAddress, proxyWalletAlice, proxyWalletAsAlice, "Alice");
    console.log("Position2 opened for Alice");

    let positionHandlerAddresses = { 
        alicePositionAddress1: alicePositionAddress1,
        alicePositionAddress2: alicePositionAddress2
    };

    let data = JSON.stringify(positionHandlerAddresses);
    fs.writeFileSync('./scripts/gorli_config/openClosePosition/cupcakes/3_positionHandlerAddresses.json', data);

    /// functions
    async function openPosition(address, proxyWallet, proxyWalletAs, username) {
        positionCounter++;
        console.log("positionNumber is " + positionCounter);
        // https://github.com/ethers-io/ethers.js/issues/478
        let openLockTokenAndDrawAbi = [
            "function openLockTokenAndDraw(address _manager, address _stabilityFeeCollector, address _tokenAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _collateralAmount, uint256 _stablecoinAmount, bool _transferFrom, bytes calldata _data)"
        ];
        let openLockTokenAndDrawIFace = new hre.ethers.utils.Interface(openLockTokenAndDrawAbi);
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(["address"], [address]);
        // console.log(encodedResult);
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
