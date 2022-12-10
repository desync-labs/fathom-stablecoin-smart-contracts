const { BigNumber } = require("ethers");

const pools = require("../../common/collateral");
const {getAddresses, Deployer} = require("../../common/addresses");
const { getProxy } = require("../../common/proxies");

const Shield = artifacts.require('./8.17/apis/fathom/Shield.sol');
const FairLaunch = artifacts.require('./8.17/apis/fathom/FairLaunch.sol');

module.exports = async function (deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const collateralTokenAdapterFactory = await getProxy(proxyFactory, "CollateralTokenAdapterFactory");
    const fathomOraclePriceFeedFactory = await getProxy(proxyFactory, "FathomOraclePriceFeedFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
    const dexPriceOracle = await getProxy(proxyFactory, "DexPriceOracle");
    const fathomToken = await artifacts.initializeInterfaceAt("FathomToken", "FathomToken");

    const addresses = getAddresses(deployer.networkId())

    const promises = [
        createAdapter(pools.WXDC, addresses.WXDC, 0),
        createAdapter(pools.USDT_COL, addresses.USDT, 1),
        createAdapter(pools.FTHM, addresses.FTHM, 2),
        createDexPriceFeed(addresses.USDT, addresses.WXDC),
        createDexPriceFeed(addresses.USDT, addresses.FTHM),
    ]

    await Promise.all(promises);

    async function createAdapter(poolId, tokenAddress, id) {
        await collateralTokenAdapterFactory.createAdapter(
            bookKeeper.address,
            poolId,
            tokenAddress,
            fathomToken.address,
            FairLaunch.address,
            id,
            Shield.address,
            Deployer,
            BigNumber.from(1000),
            Deployer,
            positionManager.address,
            { gasLimit: 5000000 }
        );
    }


    function createDexPriceFeed(token0, token1) {
        return fathomOraclePriceFeedFactory.createPriceFeed(
            dexPriceOracle.address,
            token0,
            token1,
            accessControlConfig.address,
            { gasLimit: 5000000 }
        );
    }
}