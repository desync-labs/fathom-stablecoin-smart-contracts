require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

// Position Opener addresses
const AliceAddress = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204" // <-ganache deployer address as Alice

var positionCounter = 0;

let rawdata = fs.readFileSync('../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

let rawdata2 = fs.readFileSync('./scripts/PrepSepDemo/openClosePosition/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(rawdata2);

const BookKeeper = artifacts.require('./main/stablecoin-core/BookKeeper.sol');
const PositionManager = artifacts.require('./main/managers/PositionManager.sol');
const FathomStablecoin = artifacts.require('./main/stablecoin-core/FathomStablecoin.sol');
const WXDCArtifact = artifacts.require('./main/mocks/WXDC.sol');
const ProxyWallet = artifacts.require('./main/proxy-wallet/ProxyWallet.sol');

async function main() {

    //BookKeeper attach
    const bookKeeper = await BookKeeper.at(stablecoinAddress.bookKeeper);

    //Position Manager attach
    const positionManager = await PositionManager.at(stablecoinAddress.positionManager);

    // Copyright Fathom 2022 stablecoin attach
    const fathomStablecoin = await FathomStablecoin.at(stablecoinAddress.fathomStablecoin);

    // WXDC
    const WXDC = WXDCArtifact.at(stablecoinAddress.WXDC);
    
    // 1. price of WXDC was set to 100 in the config script

    //Approve
    await WXDC.approve(proxyWalletAlice, WeiPerWad.mul(10000));

    // 2. Open a position as Alice twice
    const alicePositionAddress1 = await openPosition(AliceAddress, proxyWallets.proxyWalletAlice, proxyWalletAsAlice, "Alice");
    console.log("Position1 opened for Alice");
    const bobPositionAddress = "0x00"
    const alicePositionAddress2 = await openPosition(AliceAddress, proxyWallets.proxyWalletAlice, proxyWalletAsAlice, "Alice");
    console.log("Position2 opened for Alice");

    let positionHandlerAddresses = { 
        alicePositionAddress1: alicePositionAddress1,
        alicePositionAddress2: alicePositionAddress2
    };

    let data = JSON.stringify(positionHandlerAddresses);
    fs.writeFileSync('./scripts/PrepSepDemo/openClosePosition/cupcakes/3_positionHandlerAddresses.json', data);

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
