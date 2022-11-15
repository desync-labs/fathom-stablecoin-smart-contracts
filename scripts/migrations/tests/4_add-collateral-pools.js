const { formatBytes32String } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const BookKeeper = artifacts.require('./8.17/stablecoin-core/BookKeeper.sol');
const PositionManager = artifacts.require('./8.17/managers/PositionManager.sol');
const Shield = artifacts.require('./8.17/apis/fathom/Shield.sol');
const FairLaunch = artifacts.require('./8.17/apis/fathom/FairLaunch.sol');
const FathomToken = artifacts.require('./8.17/apis/fathom/FathomToken.sol');
const WXDC = artifacts.require('./8.17/mocks/WXDC.sol');
const USDT = artifacts.require('./8.17/mocks/USDT.sol');

const COLLATERAL_POOL_ID_WXDC = formatBytes32String("WXDC")
const COLLATERAL_POOL_ID_USDT = formatBytes32String("USDT")

const deployerAddress = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204";
const treasury = "0x299739f52346940c7c1E8E156dfD51A6eE61A5Da";

module.exports = async function (deployer) {
    const fairLaunch = await artifacts.initializeInterfaceAt("FairLaunch", "FairLaunch");
    const collateralTokenAdapterFactory = await artifacts.initializeInterfaceAt("CollateralTokenAdapterFactory", "CollateralTokenAdapterFactory");
    const collateralTokenAdapter = await artifacts.initializeInterfaceAt("CollateralTokenAdapter", "CollateralTokenAdapter");

    await collateralTokenAdapterFactory.initialize(collateralTokenAdapter.address);

    await fairLaunch.addPool(1, WXDC.address, true);
    await fairLaunch.addPool(0, USDT.address, true);

    await fairLaunch.transferOwnership(Shield.address);

    await collateralTokenAdapterFactory.createAdapter(
        BookKeeper.address,
        COLLATERAL_POOL_ID_WXDC,
        WXDC.address,             //COLLATERAL_TOKEN_ADDR
        FathomToken.address,  //Reward token addr
        FairLaunch.address,
        0,  // Pool ID
        Shield.address,   //  deployerAddress as sheild
        deployerAddress,                 // deployer as TIME_LOCK
        BigNumber.from(1000),                   //TREASURY_FEE_BPS 1000
        treasury,                 // deployer asTREASURY_ACCOUNT
        PositionManager.address
        , { gasLimit: 5000000 }
    )

    await collateralTokenAdapterFactory.createAdapter(
        BookKeeper.address,
        COLLATERAL_POOL_ID_USDT,
        USDT.address,
        FathomToken.address,
        FairLaunch.address,
        1,
        Shield.address,
        deployerAddress,
        BigNumber.from(1000),
        deployerAddress,
        PositionManager.address
        , { gasLimit: 5000000 }
    )
}