const { ethers } = require("ethers");

const { getProxy } = require("../../common/proxies");

const openPositionAndDraw = async (proxyWallet, from, collateral_pool_id, collateral, stablecoin) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
    const collateralTokenAdapterFactory = await getProxy(proxyFactory, "CollateralTokenAdapterFactory");
    const collateralTokenAdapterAddress = await collateralTokenAdapterFactory.adapters(collateral_pool_id)
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const openLockTokenAndDrawAbi = [
        "function openLockTokenAndDraw(address _manager, address _stabilityFeeCollector, address _tokenAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _collateralAmount, uint256 _stablecoinAmount, bool _transferFrom, bytes calldata _data)"
    ];
    const openLockTokenAndDrawIFace = new ethers.utils.Interface(openLockTokenAndDrawAbi);
    const openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockTokenAndDraw", [
        positionManager.address,
        stabilityFeeCollector.address,
        collateralTokenAdapterAddress,
        stablecoinAdapter.address,
        collateral_pool_id,
        collateral,
        stablecoin,
        true,
        ethers.utils.defaultAbiCoder.encode(["address"], [from]),
    ])
    await proxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall, { from: from })
}


const openXDCPositionAndDraw = async (proxyWallet, from, collateral_pool_id, collateral, stablecoin) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const ankrCollateralAdapter = await getProxy(proxyFactory, "AnkrCollateralAdapter");
    const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const abi = [
        "function openLockXDCAndDraw(address _manager, address _stabilityFeeCollector, address _xdcAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _stablecoinAmount, bytes calldata _data)"
    ];

    const iFace = new ethers.utils.Interface(abi);
    const call = iFace.encodeFunctionData("openLockXDCAndDraw", [
        positionManager.address,
        stabilityFeeCollector.address,
        ankrCollateralAdapter.address,
        stablecoinAdapter.address,
        collateral_pool_id,
        stablecoin,
        ethers.utils.defaultAbiCoder.encode(["address"], [from]),
    ])
    await proxyWallet.execute2(fathomStablecoinProxyActions.address, call, {  value: collateral,  from: from, gasLimit: 2000000 })
}

const openPosition = async (proxyWallet, from, collateral_pool_id) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");
    const openAbi = [
        "function open(address _manager, bytes32 _collateralPoolId, address _usr)"
    ];
    const openIFace = new ethers.utils.Interface(openAbi);
    const openPositionCall = openIFace.encodeFunctionData("open", [
        positionManager.address,
        collateral_pool_id,
        proxyWallet.address,
    ]);

    await proxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall, { from: from })
}

const wipeAndUnlockToken = async (proxyWallet, from, tokenAdapter, stablecoinAdapter, positionId, collateral, stablecoin) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const wipeAndUnlockTokenAbi = [
        "function wipeAndUnlockToken(address _manager, address _tokenAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinAmount, bytes calldata _data)"
    ];
    const wipeAndUnlockTokenIFace = new ethers.utils.Interface(wipeAndUnlockTokenAbi);
    const wipeAndUnlockTokenCall = wipeAndUnlockTokenIFace.encodeFunctionData("wipeAndUnlockToken", [
        positionManager.address,
        tokenAdapter,
        stablecoinAdapter,
        positionId,
        collateral,
        stablecoin,
        ethers.utils.defaultAbiCoder.encode(["address"], [from]),
    ])

    await proxyWallet.execute2(fathomStablecoinProxyActions.address, wipeAndUnlockTokenCall, { from: from })
}

const wipeAndUnlockXDC = async (proxyWallet, from, positionId, collateral, stablecoin) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");
    const ankrCollateralAdapter = await getProxy(proxyFactory, "AnkrCollateralAdapter");
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");

    const abi = [
        "function wipeAndUnlockXDC(address _manager, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinAmount, bytes calldata _data)"
    ];
    const iFace = new ethers.utils.Interface(abi);
    const call = iFace.encodeFunctionData("wipeAndUnlockXDC", [
        positionManager.address,
        ankrCollateralAdapter.address,
        stablecoinAdapter.address,
        positionId,
        collateral,
        stablecoin,
        ethers.utils.defaultAbiCoder.encode(["address"], [from]),
    ])

    await proxyWallet.execute2(fathomStablecoinProxyActions.address, call, {from: from })
}


const wipeAllAndUnlockXDC = async (proxyWallet, from, positionId, collateral) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");
    const ankrCollateralAdapter = await getProxy(proxyFactory, "AnkrCollateralAdapter");
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");

    const abi = [
        "function wipeAllAndUnlockXDC(address _manager, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, bytes calldata _data)"
    ];
    const iFace = new ethers.utils.Interface(abi);
    const call = iFace.encodeFunctionData("wipeAllAndUnlockXDC", [
        positionManager.address,
        ankrCollateralAdapter.address,
        stablecoinAdapter.address,
        positionId,
        collateral,
        ethers.utils.defaultAbiCoder.encode(["address"], [from]),
    ])

    await proxyWallet.execute2(fathomStablecoinProxyActions.address, call, {from: from })
}

const lockToken = async (proxyWallet, from, collateral_pool_id, positionId, amount) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");
    const collateralTokenAdapterFactory = await getProxy(proxyFactory, "CollateralTokenAdapterFactory");
    const collateralTokenAdapterAddress = await collateralTokenAdapterFactory.adapters(collateral_pool_id)

    const lockAbi = [
        "function lockToken(address _manager, address _tokenAdapter, uint256 _positionId, uint256 _amount, bool _transferFrom, bytes calldata _data)"
    ];
    const lockIFace = new ethers.utils.Interface(lockAbi);
    const lockTokenCall = lockIFace.encodeFunctionData("lockToken", [
        positionManager.address,
        collateralTokenAdapterAddress,
        positionId,
        amount,
        true,
        ethers.utils.defaultAbiCoder.encode(["address"], [from]),
    ])
    await proxyWallet.execute2(fathomStablecoinProxyActions.address, lockTokenCall, { from: from })
}

const draw = async (proxyWallet, from, collateral_pool_id, positionId, amount) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");
    const collateralTokenAdapterFactory = await getProxy(proxyFactory, "CollateralTokenAdapterFactory");
    const collateralTokenAdapterAddress = await collateralTokenAdapterFactory.adapters(collateral_pool_id)
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");

    const drawTokenAbi = [
        "function draw(address _manager, address _stabilityFeeCollector, address _tokenAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _amount, bytes calldata _data)"
    ];
    const drawTokenIFace = new ethers.utils.Interface(drawTokenAbi);
    const drawTokenCall = drawTokenIFace.encodeFunctionData("draw", [
        positionManager.address,
        stabilityFeeCollector.address,
        collateralTokenAdapterAddress,
        stablecoinAdapter.address,
        positionId,
        amount,
        ethers.utils.defaultAbiCoder.encode(["address"], [from])
    ]);

    await proxyWallet.execute2(fathomStablecoinProxyActions.address, drawTokenCall, { from: from })
}

const moveCollateral = async (proxyWallet, from, positionId, destination, amount, collateralTokenAdapterAddress) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const moveCollateralAbi = [
        "function moveCollateral(address _manager, uint256 _positionId, address _dst, uint256 _collateralAmount, address _adapter, bytes calldata _data)"
    ];
    const moveCollateralIFace = new ethers.utils.Interface(moveCollateralAbi);

    const moveCollateralCall = moveCollateralIFace.encodeFunctionData("moveCollateral", [
        positionManager.address,
        positionId,
        destination,
        amount,
        collateralTokenAdapterAddress,
        ethers.utils.defaultAbiCoder.encode(["address"], [from])
    ])

    await proxyWallet.execute2(fathomStablecoinProxyActions.address, moveCollateralCall, { from: from })
}

const adjustPosition = async (proxyWallet, from, positionId, collateralValue, debtShare, collateralTokenAdapterAddress) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const adjustPositionAbi = [
        "function adjustPosition(address _manager, uint256 _positionId, int256 _collateralValue, int256 _debtShare, address _adapter, bytes calldata _data)"
    ];
    const adjustPositionIFace = new ethers.utils.Interface(adjustPositionAbi);
    const adjustPositionCall = adjustPositionIFace.encodeFunctionData("adjustPosition", [
        positionManager.address,
        positionId,
        collateralValue,
        debtShare,
        collateralTokenAdapterAddress,
        ethers.utils.defaultAbiCoder.encode(["address"], [from])
    ]);
    await proxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPositionCall, { from: from })
}

const allowManagePosition = async (proxyWallet, from, positionId, user, ok) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const allowManagePositionAbi = [
        "function allowManagePosition(address _manager, uint256 _positionId, address _user, uint256 _ok)"
    ];
    const allowManagePositionIFace = new ethers.utils.Interface(allowManagePositionAbi);
    const allowManagePositionCall = allowManagePositionIFace.encodeFunctionData("allowManagePosition", [
        positionManager.address,
        positionId,
        user,
        ok
    ]);
    await proxyWallet.execute2(fathomStablecoinProxyActions.address, allowManagePositionCall, { from: from })
}

const movePosition = async (proxyWallet, from, src, dst) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const movePositionAbi = [
        "function movePosition(address _manager, uint256 _source, uint256 _destination)"
    ];
    const movePositionIFace = new ethers.utils.Interface(movePositionAbi);
    const movePositionCall = movePositionIFace.encodeFunctionData("movePosition", [
        positionManager.address,
        src,
        dst
    ]);
    await proxyWallet.execute2(fathomStablecoinProxyActions.address, movePositionCall, { from: from })
}

const tokenAdapterDeposit = async (proxyWallet, from, positionAddress, amount, collateralTokenAdapterAddress) => {
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const tokenAdapterDepositAbi = [
        "function tokenAdapterDeposit(address _adapter, address _positionAddress, uint256 _amount, bool _transferFrom, bytes calldata _data)"
    ];
    const interface = new ethers.utils.Interface(tokenAdapterDepositAbi);
    const tokenAdapterDepositCall = interface.encodeFunctionData("tokenAdapterDeposit", [
        collateralTokenAdapterAddress,
        positionAddress,
        amount,
        true,
        ethers.utils.defaultAbiCoder.encode(["address"], [from])
    ]);
    await proxyWallet.execute2(fathomStablecoinProxyActions.address, tokenAdapterDepositCall, { from: from })
}

const redeemLockedCollateral = async (proxyWallet, from, positionId) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const ankrCollateralAdapter = await getProxy(proxyFactory, "AnkrCollateralAdapter");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const abi = [
        "function redeemLockedCollateral(address _manager, uint256 _positionId, address _tokenAdapter, bytes calldata _data)"
    ];
    const interface = new ethers.utils.Interface(abi);
    const call = interface.encodeFunctionData("redeemLockedCollateral", [
        positionManager.address,
        positionId,
        ankrCollateralAdapter.address,
        ethers.utils.defaultAbiCoder.encode(["address"], [from])
    ]);
    await proxyWallet.execute2(fathomStablecoinProxyActions.address, call, { from: from })
}

const exportPosition = async (proxyWallet, from, positionId, destination) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const exportPositionAbi = [
        "function exportPosition(address _manager, uint256 _positionId, address _destination)"
    ];
    const exportPositionIFace = new ethers.utils.Interface(exportPositionAbi);
    const exportPositionCall = exportPositionIFace.encodeFunctionData("exportPosition", [
        positionManager.address,
        positionId,
        destination
    ]);
    await proxyWallet.execute2(fathomStablecoinProxyActions.address, exportPositionCall, { from: from })
}

const importPosition = async (proxyWallet, from, source, positionId) => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const importPositionAbi = [
        "function importPosition(address _manager, address _source, uint256 _positionId)"
    ];
    const importPositionIFace = new ethers.utils.Interface(importPositionAbi);
    const importPositionCall = importPositionIFace.encodeFunctionData("importPosition", [
        positionManager.address,
        source,
        positionId
    ]);
    await proxyWallet.execute2(fathomStablecoinProxyActions.address, importPositionCall, { from: from })
}

module.exports = {
    openPositionAndDraw,
    openXDCPositionAndDraw,
    openPosition,
    wipeAndUnlockToken,
    wipeAndUnlockXDC,
    wipeAllAndUnlockXDC,
    lockToken,
    draw,
    moveCollateral,
    adjustPosition,
    allowManagePosition,
    movePosition,
    tokenAdapterDeposit,
    redeemLockedCollateral,
    exportPosition,
    importPosition
}
