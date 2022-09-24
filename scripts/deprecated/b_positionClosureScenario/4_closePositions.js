const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");
const ProxyWalletArtifact = require("../../artifacts/contracts/6.12/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");
const ProxyWalletRegistryArtifact = require("../../artifacts/contracts/6.12/proxy-wallet/ProxyWalletRegistry.sol/ProxyWalletRegistry.json");
const WXDCArtifact = require("../../artifacts/contracts/6.12/mocks/BEP20.sol/BEP20.json");
const LiquidationEngineArtifact = require("../../artifacts/contracts/6.12/stablecoin-core/LiquidationEngine.sol/LiquidationEngine.json");
const BookKeeperArtifact = require("../../artifacts/contracts/6.12/stablecoin-core/BookKeeper.sol/BookKeeper.json");
const MaxUint256 = require("@ethersproject/constants");
const defaultAbiCoder = require("ethers/lib/utils.js");
const StableCoinArtifact = require("../../artifacts/contracts/6.12/stablecoin-core/FathomStablecoin.sol/FathomStablecoin.json");

const { Web3Provider } = require("@ethersproject/providers");

const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerBln = BigNumber.from(`1${"0".repeat(9)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

const FATHOM_PER_BLOCK = parseEther("100")
const COLLATERAL_POOL_ID = formatBytes32String("WXDC")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)
const TREASURY_FEE_BPS = BigNumber.from(5000)
const BPS = BigNumber.from(10000)

const privateKey1 = process.env.PRIVATE_KEY1;
const privateKey2 = process.env.PRIVATE_KEY2;
const privateKey3 = process.env.PRIVATE_KEY3;
const privateKey4 = process.env.PRIVATE_KEY4;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletDeployer = new hre.ethers.Wallet(privateKey1,provider);
const walletAlice = new hre.ethers.Wallet(privateKey2,provider);
const walletBob = new hre.ethers.Wallet(privateKey3,provider);
const walletDev = new hre.ethers.Wallet(privateKey4,provider);

// Contract addresses
const AddressZero = "0x0000000000000000000000000000000000000000";
// the first address from ganache
const DeployerAddress = walletDeployer.address;
// The second address from ganache
const AliceAddress = walletAlice.address;
// The third address from ganache
const BobAddress = walletBob.address;
// The fourth address from ganache
const DevAddress = walletDev.address;

var positionCounter = 0;

let rawdata = fs.readFileSync('./scripts/b_positionClosureScenario/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const WXDCJSON = {
    address : addresses.WXDC
}
const liquidationEngine = {
    address : addresses.liquidationEngine
}

const positionManagerJSON = {
    address : addresses.positionManager
}

const stabilityFeeCollectorJSON = {
    address : addresses.stabilityFeeCollector
}

const collateralTokenAdapter = {
    address : addresses.collateralTokenAdapter
}

const stablecoinAdapter = {
    address : addresses.stablecoinAdapter
}

const fathomStablecoinProxyActionsJSON = {
    address : addresses.fathomStablecoinProxyActions
}

const bookKeeperJSON = {
    address : addresses.bookKeeper
}

const fathomStablecoinJSON = {
    address : addresses.fathomStablecoin
}

const collateralPoolConfigJSON = {
    address : addresses.collateralPoolConfig
}

let rawdata2 = fs.readFileSync('./scripts/b_positionClosureScenario/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(rawdata2);

const proxyWalletAlice = proxyWallets.proxyWalletAlice;
const proxyWalletBob = proxyWallets.proxyWalletBob;
const proxyWalletAbi = ProxyWalletArtifact.abi;

async function main() {
    
    //BookKeeper attach
    const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
    const bookKeeper = await BookKeeper.attach(
        bookKeeperJSON.address // The deployed contract address
    )
    //FathomStablecoinProxyActions attach
    const FathomStablecoinProxyActions = await hre.ethers.getContractFactory("FathomStablecoinProxyActions");
    const fathomStablecoinProxyActions = await FathomStablecoinProxyActions.attach(
        fathomStablecoinProxyActionsJSON.address // The deployed contract address
    )
    
    //StabilityFeeCollector attach
    const StabilityFeeCollector = await hre.ethers.getContractFactory("StabilityFeeCollector");
    const stabilityFeeCollector = await StabilityFeeCollector.attach(
        stabilityFeeCollectorJSON.address // The deployed contract address
    )

    //CollateralPoolConfig attach
    const CollateralPoolConfig = await hre.ethers.getContractFactory("CollateralPoolConfig");
    const collateralPoolConfig = await CollateralPoolConfig.attach(
        collateralPoolConfigJSON.address // The deployed contract address
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

    //WXDC attach
    const BEP20 = await hre.ethers.getContractFactory("BEP20");
    const WXDC = await BEP20.attach(
        WXDCJSON.address // The deployed contract address
    )
    // WXDC as signers
    const WXDCAbi = WXDCArtifact.abi;
    const WXDCAsAlice = new hre.ethers.Contract(WXDC.address, WXDCAbi, walletAlice);
    const WXDCAsBob = new hre.ethers.Contract(WXDC.address, WXDCAbi, walletBob);

    // proxyWallet as signers
    const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAlice, proxyWalletAbi, walletAlice);
    const proxyWalletAsBob = new hre.ethers.Contract(proxyWalletBob, proxyWalletAbi, walletBob);


    // Travel to the future
    await hre.ethers.provider.send("evm_increaseTime", [BigNumber.from("31536000").toNumber()])
    await hre.ethers.provider.send("evm_mine", [])

    await stabilityFeeCollector.collect(COLLATERAL_POOL_ID)
    // var firstPositionId = 1;
    await new Promise(r => setTimeout(r, 2000));

    // Open position again in order to pay the stability fee
    var secondPositionId = await openPosition(AliceAddress, proxyWalletAsAlice);
    console.log("Second position was opened for Alice");

    // More Travel to the future
    await hre.ethers.provider.send("evm_increaseTime", [BigNumber.from("31536000").toNumber()])
    await hre.ethers.provider.send("evm_mine", [])

    await new Promise(r => setTimeout(r, 2000));

    // Approve stablecoin
    const stablecoinAsAlice = new hre.ethers.Contract(fathomStablecoin.address, StableCoinArtifact.abi, walletAlice);
    await stablecoinAsAlice.approve(proxyWalletAlice, WeiPerWad.mul(10000));

    // Close first position
    await wipeAllAndUnlockToken(AliceAddress, proxyWalletAsAlice, secondPositionId);

    /// functions
    async function openPosition(address, proxyWalletAs) {
        // https://github.com/ethers-io/ethers.js/issues/478
        let openLockTokenAndDrawAbi = [
            "function openLockTokenAndDraw(address _manager, address _stabilityFeeCollector, address _tokenAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _collateralAmount, uint256 _stablecoinAmount, bool _transferFrom, bytes calldata _data)"
        ];
        let openLockTokenAndDrawIFace = new hre.ethers.utils.Interface(openLockTokenAndDrawAbi);
        const encodedResult = hre.ethers.utils.defaultAbiCoder.encode(["address"], [address]);
        let openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            WeiPerWad,
            WeiPerWad,
            true,
            encodedResult,
        ]);

        const openPositionCallTx = await proxyWalletAs.execute2(fathomStablecoinProxyActions.address, openPositionCall);

        const fathomStablecoinBalance = await fathomStablecoin.balanceOf(address)
        console.log(`Stablecoin balance : ${fathomStablecoinBalance}`)

        const positionId = await positionManager.ownerLastPositionId(proxyWalletAs.address);

        await printCollateralAndDebtShare(positionId);

        return positionId;
    }

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
            positionManager.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            positionId,
            WeiPerWad,
            encodedResult,
        ]);
        const wipeAllAndUnlockTokentTx = await proxyWalletAs.execute2(fathomStablecoinProxyActions.address, wipeAllAndUnlockTokenCall);
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

    async function printCollateralAndDebtShare(positionId) {
        const positionAddress = await positionManager.positions(positionId)
            const [lockedCollateral, debtShare] = await bookKeeper.positions(
                COLLATERAL_POOL_ID,
                positionAddress
            )
        
            console.log(`Position ${positionId} locked collateral : ${lockedCollateral}`)
            console.log(`Position ${positionId} debt share balance : ${debtShare}`)
        }

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
