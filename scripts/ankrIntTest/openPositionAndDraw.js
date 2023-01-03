
const { ethers } = require("ethers");
const { WeiPerWad } = require("../tests/helper/unit");

const openPositionAndDraw = async (proxyWallet, from, collateral_pool_id, stablecoinAmount) => {
    const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
    const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
    const stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "StabilityFeeCollector");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");
    const xdcAdapter = await artifacts.initializeInterfaceAt("AnkrCollateralAdapter", "AnkrCollateralAdapter");

    const openLockXDCAndDrawAbi = [
        "function openLockXDCAndDraw(address _manager, address _stabilityFeeCollector, address _xdcAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _stablecoinAmount, bytes calldata _data)"
    ];
    const openLockTokenAndDrawIFace = new ethers.utils.Interface(openLockXDCAndDrawAbi);
    const openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockTokenAndDraw", [
        positionManager.address,
        stabilityFeeCollector.address,
        xdcAdapter.address,
        stablecoinAdapter.address,
        collateral_pool_id,
        stablecoinAmount, // wad
        ethers.utils.defaultAbiCoder.encode(["address"], [from]),
    ])
    await proxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall, { from: from, value: ethers.utils.parseEther("1") });
}

module.exports = {openPositionAndDraw}