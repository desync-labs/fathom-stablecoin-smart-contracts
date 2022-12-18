const { formatBytes32String } = require("ethers/lib/utils");
const { BigNumber, ethers } = require("ethers");

const BookKeeper = artifacts.require('./main/stablecoin-core/BookKeeper.sol');
const PositionManager = artifacts.require('./main/managers/PositionManager.sol');
const Shield = artifacts.require('./fair-launch/Shield.sol');
const FairLaunch = artifacts.require('./fair-launch/FairLaunch.sol');
const FathomToken = artifacts.require('./tests/FathomToken.sol');
const ERC20Mintable = artifacts.require('./tests/mocks/ERC20Mintable.sol');

const COLLATERAL_POOL_ID_WXDC = formatBytes32String("WXDC")
const COLLATERAL_POOL_ID_USDT = formatBytes32String("USDT")

const treasury = "0x299739f52346940c7c1E8E156dfD51A6eE61A5Da";
const DeployerWallet = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204";
const AliceWallet = "0xc0Ee98ac1a44B56fbe2669A3B3C006DEB6fDd0f9";
const BobWallet = "0x01d2D3da7a42F64e7Dc6Ae405F169836556adC86";


module.exports = async function (deployer) {
    const fairLaunch = await artifacts.initializeInterfaceAt("FairLaunch", "FairLaunch");
    const collateralTokenAdapterFactory = await artifacts.initializeInterfaceAt("CollateralTokenAdapterFactory", "CollateralTokenAdapterFactory");

    const fathomToken = await artifacts.initializeInterfaceAt("FathomToken", "FathomToken");
    const shield = await artifacts.initializeInterfaceAt("Shield", "Shield");

    await deployer.deploy(ERC20Mintable, "WXDC", "WXDC", { gas: 3050000 });
    const wdxcAddr = ERC20Mintable.address;
    await deployer.deploy(ERC20Mintable, "USDT", "USDT", { gas: 3050000 });
    const usdtAddr = ERC20Mintable.address;

    const WXDC = await artifacts.initializeInterfaceAt("ERC20Mintable", wdxcAddr);
    const USDT = await artifacts.initializeInterfaceAt("ERC20Mintable", usdtAddr);

    await fairLaunch.addPool(1, wdxcAddr, true);
    await fairLaunch.addPool(0, usdtAddr, true);

    await fairLaunch.transferOwnership(Shield.address);

    await collateralTokenAdapterFactory.createAdapter(
        BookKeeper.address,
        COLLATERAL_POOL_ID_WXDC,
        wdxcAddr,             //COLLATERAL_TOKEN_ADDR
        FathomToken.address,  //Reward token addr
        FairLaunch.address,
        0,  // Pool ID
        Shield.address,   //  DeployerWallet as sheild
        DeployerWallet,                 // deployer as TIME_LOCK
        BigNumber.from(1000),                   //TREASURY_FEE_BPS 1000
        treasury,                 // deployer asTREASURY_ACCOUNT
        PositionManager.address
        , { gasLimit: 5000000 }
    )

    await collateralTokenAdapterFactory.createAdapter(
        BookKeeper.address,
        COLLATERAL_POOL_ID_USDT,
        usdtAddr,
        FathomToken.address,
        FairLaunch.address,
        1,
        Shield.address,
        DeployerWallet,
        BigNumber.from(1000),
        DeployerWallet,
        PositionManager.address
        , { gasLimit: 5000000 }
    )


    await fathomToken.mint(DeployerWallet, ethers.utils.parseEther("150"), { gasLimit: 1000000 })
    await fathomToken.transferOwnership(fairLaunch.address)

    await WXDC.mint(AliceWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 });
    await WXDC.mint(BobWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 })

    await USDT.mint(AliceWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 });
    await USDT.mint(BobWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 })

    await shield.transferOwnership(DeployerWallet)
}