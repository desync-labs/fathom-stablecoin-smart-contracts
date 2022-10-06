const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");
const ProxyWalletArtifact = require("../../artifacts/contracts/6.12/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");
const WXDCArtifact = require("../../artifacts/contracts/6.12/mocks/BEP20.sol/BEP20.json");

const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

const privateKey2 = process.env.PRIVATE_KEY2;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletAlice = new hre.ethers.Wallet(privateKey2,provider);

// Alice address
const AliceAddress = walletAlice.address;

var positionCounter = 0;

let rawdata = fs.readFileSync('./scripts/l_withdrawStablecoin/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const WXDCJSON = {
    address : addresses.WXDC
}

const positionManagerJSON = {
    address : addresses.positionManager
}

const collateralTokenAdapterJSON = {
    address : addresses.collateralTokenAdapter
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

const collateralPoolConfigJSON = {
    address : addresses.collateralPoolConfig
}

let rawdata2 = fs.readFileSync('./scripts/l_withdrawStablecoin/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(rawdata2);

const proxyWalletAlice = proxyWallets.proxyWalletAlice;
const proxyWalletAbi = ProxyWalletArtifact.abi;

async function main() {

    //BookKeeper attach
    const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
    const bookKeeper = await BookKeeper.attach(
        bookKeeperJSON.address // The deployed contract address
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

    // proxyWallet as signers
    const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAlice, proxyWalletAbi, walletAlice);

    // 1. Set priceWithSafetyMargin for WXDC to 2 USD
    await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay.mul(2))

    //Approve
    await WXDCAsAlice.approve(proxyWalletAlice, WeiPerWad.mul(10000));

    // 2. Open position without locking collateral
    const aliceFirstPositionAddress = await openPosition(AliceAddress, proxyWalletAlice, proxyWalletAsAlice, "Alice");
    console.log("First position opened for Alice");

    // 3. Lock some collateral
    await lockCollateral(1, WeiPerWad, proxyWalletAsAlice, AliceAddress)

    let positionHandlerAddresses = { 
        aliceFirstPositionAddress: aliceFirstPositionAddress
    };

    let data = JSON.stringify(positionHandlerAddresses);
    fs.writeFileSync('./scripts/l_withdrawStablecoin/cupcakes/3_positionHandlerAddresses.json', data);

    /// functions
    async function openPosition(address, proxyWallet, proxyWalletAs, username) {
        positionCounter++;
        // https://github.com/ethers-io/ethers.js/issues/478
        let openAbi = [
            "function open(address _manager, bytes32 _collateralPoolId, address _usr)"
        ];

        let openIFace = new hre.ethers.utils.Interface(openAbi);
        let openPositionCall = openIFace.encodeFunctionData("open", [
            positionManager.address,
            COLLATERAL_POOL_ID,
            proxyWallet,
        ]);

        const positionId = await proxyWalletAs.execute2(fathomStablecoinProxyActions.address, openPositionCall);
        const positionAddress = await positionManager.positions(positionCounter)
        // const result = await bookKeeper.stablecoin();
        console.log(`Position Handler's address for positionId ${positionCounter} `+positionAddress)
        const fathomStablecoinBalance = await fathomStablecoin.balanceOf(address)
        console.log(username + " stablecoin balance : " + fathomStablecoinBalance) 
        return positionAddress;
    }
}

async function lockCollateral(positionId, amount, proxyWalletAs, address) {
    const lockAbi = [
        "function lockToken(address _manager, address _tokenAdapter, uint256 _positionId, uint256 _amount, bool _transferFrom, bytes calldata _data)"
    ];
    const encodedAddress = hre.ethers.utils.defaultAbiCoder.encode(["address"], [address]);

    let lockIFace = new hre.ethers.utils.Interface(lockAbi);
    let lockCall = lockIFace.encodeFunctionData("lockToken", [
        positionManagerJSON.address,
        collateralTokenAdapterJSON.address,
        positionId,
        amount,
        true,
        encodedAddress
    ]);

    const tx = await proxyWalletAs.execute2(fathomStablecoinProxyActions.address, lockCall);
    console.log(amount + " collateral was locked");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
