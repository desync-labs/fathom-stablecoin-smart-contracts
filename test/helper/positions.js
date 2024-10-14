const { ethers } = require("hardhat");
const provider = ethers.provider;

const { getProxy } = require("../../common/proxies");

const openPositionAndDraw = async (proxyWallet, from, collateralPoolId, collateral, stablecoin) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
  const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
  const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
  const collateralTokenAdapterAddress = await collateralPoolConfig.getAdapter(collateralPoolId);

  const openLockTokenAndDrawAbi = [
    "function openLockTokenAndDraw(address _manager, address _stabilityFeeCollector, address _tokenAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _collateralAmount, uint256 _stablecoinAmount, bool _transferFrom, bytes calldata _data)",
  ];
  const openLockTokenAndDrawIFace = new ethers.utils.Interface(openLockTokenAndDrawAbi);
  const openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockTokenAndDraw", [
    positionManager.address,
    stabilityFeeCollector.address,
    collateralTokenAdapterAddress,
    stablecoinAdapter.address,
    collateralPoolId,
    collateral,
    stablecoin,
    true,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);
  await proxyWallet.connect(provider.getSigner(from)).execute(openPositionCall);
};

const openNATIVEPositionAndDraw = async (proxyWallet, from, collateralPoolId, collateral, stablecoin) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");

  const abi = [
    "function openLockNATIVEAndDraw(address _manager, address _stabilityFeeCollector, address _nativeAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _stablecoinAmount, bytes calldata _data)",
  ];

  const iFace = new ethers.utils.Interface(abi);
  const call = iFace.encodeFunctionData("openLockNATIVEAndDraw", [
    positionManager.address,
    stabilityFeeCollector.address,
    collateralTokenAdapter.address,
    stablecoinAdapter.address,
    collateralPoolId,
    stablecoin,
    "0x00",
  ]);
  await proxyWallet.connect(provider.getSigner(from)).execute(call, { value: collateral });
};

const openNATIVEPositionAndDrawMock = async (proxyWallet, from, collateralPoolId, collateral, stablecoin) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
  const mockCollateralTokenAdapter = await getProxy(proxyFactory, "MockCollateralTokenAdapter");
  const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
  const fathomStablecoinProxyActions = await getProxy(proxyFactory, "FathomStablecoinProxyActions");

  const abi = [
    "function openLockNATIVEAndDraw(address _manager, address _stabilityFeeCollector, address _nativeAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _stablecoinAmount, bytes calldata _data)",
  ];
  const iFace = new ethers.utils.Interface(abi);
  const call = iFace.encodeFunctionData("openLockNATIVEAndDraw", [
    positionManager.address,
    stabilityFeeCollector.address,
    mockCollateralTokenAdapter.address,
    stablecoinAdapter.address,
    collateralPoolId,
    stablecoin,
    "0x00",
  ]);
  await proxyWallet.connect(provider.getSigner(from)).execute(call, { value: collateral });
};

const openPosition = async (proxyWallet, from, collateralPoolId) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const openAbi = ["function open(address _manager, bytes32 _collateralPoolId, address _usr)"];
  const openIFace = new ethers.utils.Interface(openAbi);
  const openPositionCall = openIFace.encodeFunctionData("open", [positionManager.address, collateralPoolId, proxyWallet.address]);

  await proxyWallet.connect(provider.getSigner(from)).execute(openPositionCall);
};

const wipeAndUnlockToken = async (proxyWallet, from, tokenAdapter, positionId, collateral, stablecoin) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");

  const wipeAndUnlockTokenAbi = [
    "function wipeAndUnlockToken(address _manager, address _tokenAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinAmount, bytes calldata _data)",
  ];
  const wipeAndUnlockTokenIFace = new ethers.utils.Interface(wipeAndUnlockTokenAbi);
  const wipeAndUnlockTokenCall = wipeAndUnlockTokenIFace.encodeFunctionData("wipeAndUnlockToken", [
    positionManager.address,
    tokenAdapter,
    stablecoinAdapter.address,
    positionId,
    collateral,
    stablecoin,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);

  await proxyWallet.connect(provider.getSigner(from)).execute(wipeAndUnlockTokenCall);
};

const wipeAndUnlockNATIVE = async (proxyWallet, from, positionId, collateral, stablecoin) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");

  const abi = [
    "function wipeAndUnlockNATIVE(address _manager, address _nativeAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinAmount, bytes calldata _data)",
  ];
  const iFace = new ethers.utils.Interface(abi);
  const call = iFace.encodeFunctionData("wipeAndUnlockNATIVE", [
    positionManager.address,
    collateralTokenAdapter.address,
    stablecoinAdapter.address,
    positionId,
    collateral,
    stablecoin,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);

  await proxyWallet.connect(provider.getSigner(from)).execute(call);
};

const wipeAllAndUnlockNATIVE = async (proxyWallet, from, positionId, collateral) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");

  const abi = [
    "function wipeAllAndUnlockNATIVE(address _manager, address _nativeAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, bytes calldata _data)",
  ];
  const iFace = new ethers.utils.Interface(abi);
  const call = iFace.encodeFunctionData("wipeAllAndUnlockNATIVE", [
    positionManager.address,
    collateralTokenAdapter.address,
    stablecoinAdapter.address,
    positionId,
    collateral,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);

  await proxyWallet.connect(provider.getSigner(from)).execute(call);
};

const lockToken = async (proxyWallet, from, collateralPoolId, positionId, amount) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const collateralTokenAdapterFactory = await getProxy(proxyFactory, "CollateralTokenAdapterFactory");
  const collateralTokenAdapterAddress = await collateralTokenAdapterFactory.adapters(collateralPoolId);

  const lockAbi = [
    "function lockToken(address _manager, address _tokenAdapter, uint256 _positionId, uint256 _amount, bool _transferFrom, bytes calldata _data)",
  ];
  const lockIFace = new ethers.utils.Interface(lockAbi);
  const lockTokenCall = lockIFace.encodeFunctionData("lockToken", [
    positionManager.address,
    collateralTokenAdapterAddress,
    positionId,
    amount,
    true,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);
  await proxyWallet.connect(provider.getSigner(from)).execute(lockTokenCall);
};

const lockNATIVE = async (proxyWallet, from, positionId, amount) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

  const lockAbi = ["function lockNATIVE(address _manager, address _nativeAdapter, uint256 _positionId, bytes calldata _data)"];
  const lockIFace = new ethers.utils.Interface(lockAbi);
  const lockTokenCall = lockIFace.encodeFunctionData("lockNATIVE", [
    positionManager.address,
    collateralTokenAdapter.address,
    positionId,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);
  await proxyWallet.connect(provider.getSigner(from)).execute(lockTokenCall, { value: amount });
};

// function safeLockNATIVE(address _manager, address _nativeAdapter, uint256 _positionId, address _owner, bytes calldata _data)
const safeLockNATIVE = async (proxyWallet, from, positionId, amount) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

  const lockAbi = ["function safeLockNATIVE(address _manager, address _nativeAdapter, uint256 _positionId, address _owner, bytes calldata _data)"];
  const lockIFace = new ethers.utils.Interface(lockAbi);
  const lockTokenCall = lockIFace.encodeFunctionData("safeLockNATIVE", [
    positionManager.address,
    collateralTokenAdapter.address,
    positionId,
    proxyWallet.address,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);
  await proxyWallet.connect(provider.getSigner(from)).execute(lockTokenCall, { value: amount });
};

const draw = async (proxyWallet, from, collateralPoolId, positionId, amount) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
  const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");

  const drawTokenAbi = [
    "function draw(address _manager, address _stabilityFeeCollector, address _stablecoinAdapter, uint256 _positionId, uint256 _amount, bytes calldata _data)",
  ];
  const drawTokenIFace = new ethers.utils.Interface(drawTokenAbi);
  const drawTokenCall = drawTokenIFace.encodeFunctionData("draw", [
    positionManager.address,
    stabilityFeeCollector.address,
    stablecoinAdapter.address,
    positionId,
    amount,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);

  await proxyWallet.connect(provider.getSigner(from)).execute(drawTokenCall);
};

const moveCollateral = async (proxyWallet, from, positionId, destination, amount) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");

  const moveCollateralAbi = [
    "function moveCollateral(address _manager, uint256 _positionId, address _dst, uint256 _collateralAmount, bytes calldata _data)",
  ];
  const moveCollateralIFace = new ethers.utils.Interface(moveCollateralAbi);

  const moveCollateralCall = moveCollateralIFace.encodeFunctionData("moveCollateral", [
    positionManager.address,
    positionId,
    destination,
    amount,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);

  await proxyWallet.connect(provider.getSigner(from)).execute(moveCollateralCall);
};

const adjustPosition = async (proxyWallet, from, positionId, collateralValue, debtShare) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");

  const adjustPositionAbi = [
    "function adjustPosition(address _manager, uint256 _positionId, int256 _collateralValue, int256 _debtShare, bytes calldata _data)",
  ];
  const adjustPositionIFace = new ethers.utils.Interface(adjustPositionAbi);
  const adjustPositionCall = adjustPositionIFace.encodeFunctionData("adjustPosition", [
    positionManager.address,
    positionId,
    collateralValue,
    debtShare,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);
  await proxyWallet.connect(provider.getSigner(from)).execute(adjustPositionCall);
};

const allowManagePosition = async (proxyWallet, from, positionId, user, ok) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");

  const allowManagePositionAbi = ["function allowManagePosition(address _manager, uint256 _positionId, address _user, bool _ok)"];
  const allowManagePositionIFace = new ethers.utils.Interface(allowManagePositionAbi);
  const allowManagePositionCall = allowManagePositionIFace.encodeFunctionData("allowManagePosition", [positionManager.address, positionId, user, ok]);
  await proxyWallet.connect(provider.getSigner(from)).execute(allowManagePositionCall);
};

const movePosition = async (proxyWallet, from, src, dst) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");

  const movePositionAbi = ["function movePosition(address _manager, uint256 _source, uint256 _destination)"];
  const movePositionIFace = new ethers.utils.Interface(movePositionAbi);
  const movePositionCall = movePositionIFace.encodeFunctionData("movePosition", [positionManager.address, src, dst]);
  await proxyWallet.connect(provider.getSigner(from)).execute(movePositionCall);
};

const tokenAdapterDeposit = async (proxyWallet, from, positionAddress, amount, collateralTokenAdapterAddress) => {
  const tokenAdapterDepositAbi = [
    "function tokenAdapterDeposit(address _adapter, address _positionAddress, uint256 _amount, bool _transferFrom, bytes calldata _data)",
  ];
  const interface = new ethers.utils.Interface(tokenAdapterDepositAbi);
  const tokenAdapterDepositCall = interface.encodeFunctionData("tokenAdapterDeposit", [
    collateralTokenAdapterAddress,
    positionAddress,
    amount,
    true,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);
  await proxyWallet.connect(provider.getSigner(from)).execute(tokenAdapterDepositCall);
};

const nativeAdapterDeposit = async (proxyWallet, from, positionAddress, amount) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

  const tokenAdapterDepositAbi = ["function nativeAdapterDeposit(address _adapter, address _positionAddress, bytes calldata _data)"];
  const interface = new ethers.utils.Interface(tokenAdapterDepositAbi);
  const tokenAdapterDepositCall = interface.encodeFunctionData("nativeAdapterDeposit", [
    collateralTokenAdapter.address,
    positionAddress,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);
  await proxyWallet.connect(provider.getSigner(from)).execute(tokenAdapterDepositCall, { value: amount });
};

const redeemLockedCollateral = async (proxyWallet, from, positionId) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");

  const abi = ["function redeemLockedCollateral(address _manager, uint256 _positionId, bytes calldata _data)"];
  const interface = new ethers.utils.Interface(abi);
  const call = interface.encodeFunctionData("redeemLockedCollateral", [
    positionManager.address,
    positionId,
    ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ]);
  await proxyWallet.connect(provider.getSigner(from)).execute(call);
};

const exportPosition = async (proxyWallet, from, positionId, destination) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");

  const exportPositionAbi = ["function exportPosition(address _manager, uint256 _positionId, address _destination)"];
  const exportPositionIFace = new ethers.utils.Interface(exportPositionAbi);
  const exportPositionCall = exportPositionIFace.encodeFunctionData("exportPosition", [positionManager.address, positionId, destination]);
  await proxyWallet.connect(provider.getSigner(from)).execute(exportPositionCall);
};

const importPosition = async (proxyWallet, from, source, positionId) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const positionManager = await getProxy(proxyFactory, "PositionManager");

  const importPositionAbi = ["function importPosition(address _manager, address _source, uint256 _positionId)"];
  const importPositionIFace = new ethers.utils.Interface(importPositionAbi);
  const importPositionCall = importPositionIFace.encodeFunctionData("importPosition", [positionManager.address, source, positionId]);
  await proxyWallet.connect(provider.getSigner(from)).execute(importPositionCall);
};

const transfer = async (proxyWallet, from, collateralToken, to, amount) => {
  const transferAbi = ["function transfer(address _collateralToken, address _to, uint256 _amount)"];
  const transferIFace = new ethers.utils.Interface(transferAbi);
  const transferCall = transferIFace.encodeFunctionData("transfer", [collateralToken, to, amount]);
  await proxyWallet.connect(provider.getSigner(from)).execute(transferCall);
};

const emergencyWithdraw = async (proxyWallet, from, collateralTokenAdapter) => {
  const emergencyWithdrawAbi = ["function emergencyWithdraw(address _adapter, address _to)"];
  const emergencyWithdrawIFace = new ethers.utils.Interface(emergencyWithdrawAbi);
  const emergencyWithdrawCall = emergencyWithdrawIFace.encodeFunctionData("emergencyWithdraw", [collateralTokenAdapter, from]);
  await proxyWallet.connect(provider.getSigner(from)).execute(emergencyWithdrawCall);
};

module.exports = {
  openPositionAndDraw,
  openNATIVEPositionAndDraw,
  openNATIVEPositionAndDrawMock,
  openPosition,
  wipeAndUnlockToken,
  wipeAndUnlockNATIVE,
  wipeAllAndUnlockNATIVE,
  lockToken,
  lockNATIVE,
  safeLockNATIVE,
  draw,
  moveCollateral,
  adjustPosition,
  allowManagePosition,
  movePosition,
  tokenAdapterDeposit,
  nativeAdapterDeposit,
  redeemLockedCollateral,
  exportPosition,
  importPosition,
  transfer,
  emergencyWithdraw,
};
