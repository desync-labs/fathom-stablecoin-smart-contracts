const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");
const ProxyWalletArtifact = require("../../../artifacts/contracts/main/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");
const WXDCArtifact = require("../../../artifacts/contracts/main/mocks/BEP20.sol/BEP20.json");
const StableCoinArtifact = require("../../../artifacts/contracts/main/stablecoin-core/FathomStablecoin.sol/FathomStablecoin.json");

const WeiPerWad = hre.ethers.constants.WeiPerEther

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

require("dotenv").config();
const privateKey1 = process.env.GORLI_DEPLOYER;
const url = "https://goerli.infura.io/v3/d85fb151be214d8eaee85c855d9d3dab";

let provider = new ethers.providers.JsonRpcProvider(url);
const walletDeployer = new ethers.Wallet(privateKey1,provider);

// Contract addresses
const AliceAddress = walletDeployer.address;

var positionCounter = 0;

let rawdata = fs.readFileSync('gorli.json');
let stablecoinAddress = JSON.parse(rawdata);

let rawdata2 = fs.readFileSync('./scripts/PrepSepDemo/openClosePosition/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(rawdata2);

const proxyWalletAlice = proxyWallets.proxyWalletAlice;
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

    //WXDC attach
    const BEP20 = await hre.ethers.getContractFactory("BEP20");
    const WXDC = await BEP20.attach(
        stablecoinAddress.WXDC // The deployed contract address
    )

    // WXDC as signers
    const WXDCAbi = WXDCArtifact.abi;
    const WXDCAsAlice = new hre.ethers.Contract(stablecoinAddress.WXDC, WXDCAbi, walletAlice);

    // proxyWallet as signers
    const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAlice, proxyWalletAbi, walletAlice);

    // Approve stablecoin
    const stablecoinAsAlice = new hre.ethers.Contract(fathomStablecoin.address, StableCoinArtifact.abi, walletAlice);
    await stablecoinAsAlice.approve(proxyWalletAlice, WeiPerWad.mul(1));

    // Close position id 1
    await wipeAllAndUnlockToken(AliceAddress, proxyWalletAsAlice, 1);

    async function wipeAllAndUnlockToken(address, proxyWalletAs, positionId) {
        const positionAddress = await positionManager.positions(positionId)
        const stablecoinBeforeWipe = await fathomStablecoin.balanceOf(address)
        console.log("Stablecoin balance before wipe : " + stablecoinBeforeWipe)
    
        const [lockedCollateralBefore, debtShareBefore] = await bookKeeper.positions(
          COLLATERAL_POOL_ID,
          positionAddress
        )
        console.log("Locked collateral balance before wipe : " + lockedCollateralBefore)
        console.log("debt share balance before wipe : " + debtShareBefore)
    
        const WXDCBalanceOfBeforeWipe = await WXDC.balanceOf(address)
        console.log("WXDC balance before wipe : " + WXDCBalanceOfBeforeWipe)
    
        // https://github.com/ethers-io/ethers.js/issues/478
        let openLockTokenAndDrawAbi = [
          "function wipeAllAndUnlockToken(address _manager, address _tokenAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, bytes calldata _data)"
        ];
        let openLockTokenAndDrawIFace = new hre.ethers.utils.Interface(openLockTokenAndDrawAbi);
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(["address"], [address]);

        let wipeAllAndUnlockTokenCall = openLockTokenAndDrawIFace.encodeFunctionData("wipeAllAndUnlockToken", [
          stablecoinAddress.positionManager,
          stablecoinAddress.collateralTokenAdapter,
          stablecoinAddress.stablecoinAdapter,
          positionId,
          WeiPerWad,
          encodedResult,
        ]);
        const wipeAllAndUnlockTokentTx = await proxyWalletAs.execute2(stablecoinAddress.fathomStablecoinProxyActions, wipeAllAndUnlockTokenCall);
        console.log("wiped")
    
        const stablecoinAfterWipe = await fathomStablecoin.balanceOf(address)
        console.log("Stablecoin balance after wipe : " + stablecoinAfterWipe)
    
        const WXDCBalanceOfAfterWipe = await WXDC.balanceOf(address)
        console.log("WXDC balance after wipe : " + WXDCBalanceOfAfterWipe)
    
        const [lockedCollateralAfterWipe, debtShareAfterWipe] = await bookKeeper.positions(
          COLLATERAL_POOL_ID,
          positionAddress
        )
    
        console.log("Locked collateral balance after wipe : " + lockedCollateralAfterWipe)
        console.log("debt share balance after wipe : " + debtShareAfterWipe)
      }


    /// functions



}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
