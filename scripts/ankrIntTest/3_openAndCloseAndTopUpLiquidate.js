// const fs = require('fs');
// const rawdata = fs.readFileSync('../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");

const { MaxUint256 } = require("@ethersproject/constants");


const { getProxy } = require("../common/proxies");

const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress, BobAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");


const openPositionAndDraw = async (proxyWallet, from, collateral_pool_id, stablecoinAmount) => {

  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");

  console.log("here1");

  const openLockXDCAndDrawAbi = [
      "function openLockXDCAndDraw(address _manager, address _stabilityFeeCollector, address _xdcAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _stablecoinAmount, bytes calldata _data)"
  ];
  const openLockTokenAndDrawIFace = new ethers.utils.Interface(openLockXDCAndDrawAbi);
  const openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockXDCAndDraw", [
      positionManager.address,
      stabilityFeeCollector.address,
      collateralTokenAdapter.address,
      stablecoinAdapter.address,
      collateral_pool_id,
      stablecoinAmount, // wad
      ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ])
  console.log("here2");
  await proxyWallet.execute(openPositionCall, { from: from, value: ethers.constants.WeiPerEther.mul(20) })
  console.log("here3");
  const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
  const fathomBalance = await fathomStablecoin.balanceOf(from);
  console.log("FXD balance of Alice is " + fathomBalance);
  const provider = ethers.getDefaultProvider("http://127.0.0.1:8545");
  const endBalance = await provider.getBalance(from);
  console.log("ETH balance of Alice is " + endBalance);
  const lastPositionIdYo = await positionManager.lastPositionId();
  const lastPositionAddress = await positionManager.positions(lastPositionIdYo);
  console.log("positionId is "+ lastPositionIdYo);
  const [collateral, debtShare] = await bookKeeper.positions(COLLATERAL_POOL_ID, lastPositionAddress);
  const debtAccumulatedRate = await collateralPoolConfig.getDebtAccumulatedRate(COLLATERAL_POOL_ID);
  console.log(collateral.toString());
  console.log(debtShare.mul(debtAccumulatedRate).toString());
                                                                                                        // how much XDC to collateralize
}

const wipeAndUnlockXDC = async (proxyWallet, from, positionId, collateralAmount, stablecoinAmount) => {

  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
  const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
  // await fathomStablecoin.approve(proxyWallet.address, stablecoinAmount, { from: from})
  await fathomStablecoin.approve(proxyWallet.address, WeiPerWad.mul(10000), { from: from})

  console.log("partial closePosition");


  const wipeAndUnlockXDCAbi = [
      "function wipeAndUnlockXDC(address _manager, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinAmount, bytes calldata _data)"
  ];
  const wipeAndUnlockXDCIFace = new ethers.utils.Interface(wipeAndUnlockXDCAbi);
  const closeParialPositionCall = wipeAndUnlockXDCIFace.encodeFunctionData("wipeAndUnlockXDC", [
      positionManager.address,
      collateralTokenAdapter.address,
      stablecoinAdapter.address,
      positionId,
      collateralAmount, // wad
      stablecoinAmount, // wad
      ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ])

  await proxyWallet.execute(closeParialPositionCall, { from: from })
  console.log("closePositionPartial");
  const fathomBalance = await fathomStablecoin.balanceOf(from);
  console.log("FXD balance of Alice is " + fathomBalance);
  const provider = ethers.getDefaultProvider("http://127.0.0.1:8545");
  const endBalance = await provider.getBalance(from);
  console.log("ETH balance of Alice is " + endBalance);

  console.log("positionId is "+ positionId);
  const lastPositionAddress = await positionManager.positions(positionId);
  const [collateral, debtShare] = await bookKeeper.positions(COLLATERAL_POOL_ID, lastPositionAddress);
  const debtAccumulatedRate = await collateralPoolConfig.getDebtAccumulatedRate(COLLATERAL_POOL_ID);
  console.log(collateral.toString());
  console.log(debtShare.mul(debtAccumulatedRate).toString());
}

const lockXDCAndDraw = async (proxyWallet, from, positionId, stablecoinAmount) => {

  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
  const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
  const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");

  const lockXDCAndDrawAbi = [
      "function lockXDCAndDraw(address _manager, address _stabilityFeeCollector, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _stablecoinAmount, bytes calldata _data)"
  ];
  const lockXDCAndDrawIFace = new ethers.utils.Interface(lockXDCAndDrawAbi);
  const topUpCall = lockXDCAndDrawIFace.encodeFunctionData("lockXDCAndDraw", [
      positionManager.address,
      stabilityFeeCollector.address,
      collateralTokenAdapter.address,
      stablecoinAdapter.address,
      positionId,
      stablecoinAmount, // wad
      ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ])

  await proxyWallet.execute(topUpCall, { from: from, value: ethers.constants.WeiPerEther.mul(7) })

  console.log("topUp");
  const fathomBalance = await fathomStablecoin.balanceOf(from);
  console.log("FXD balance of Alice is " + fathomBalance);
  const provider = ethers.getDefaultProvider("http://127.0.0.1:8545");
  const endBalance = await provider.getBalance(from);
  console.log("ETH balance of Alice is " + endBalance);
 
  console.log("positionId is "+ positionId);
  const lastPositionAddress = await positionManager.positions(positionId);
  const [collateral, debtShare] = await bookKeeper.positions(COLLATERAL_POOL_ID, lastPositionAddress);
  const debtAccumulatedRate = await collateralPoolConfig.getDebtAccumulatedRate(COLLATERAL_POOL_ID);
  console.log(collateral.toString());
  console.log(debtShare.mul(debtAccumulatedRate).toString());
}

module.exports = async function(deployer) {
  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

  //making wallet
  // const proxyWalletRegistry = await ProxyWalletRegistry.at(stablecoinAddress.proxyWalletRegistry);
  const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");

  //uncomment below to make wallet
  await proxyWalletRegistry.build(AliceAddress, { from: AliceAddress, gasLimit: 2000000 })
  const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress)

  const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletAliceAddress);
  const proxyWalletAsAliceOwner = await proxyWalletAsAlice.owner({ from: AliceAddress });
  console.log(AliceAddress == proxyWalletAsAliceOwner);
                                                                                  //how much FXD to borrow
  await openPositionAndDraw(proxyWalletAsAlice, AliceAddress, COLLATERAL_POOL_ID, WeiPerWad.mul(11));
  await openPositionAndDraw(proxyWalletAsAlice, AliceAddress, COLLATERAL_POOL_ID, WeiPerWad.mul(12));
  await openPositionAndDraw(proxyWalletAsAlice, AliceAddress, COLLATERAL_POOL_ID, WeiPerWad.mul(13));

  // await wipeAndUnlockXDC(proxyWalletAsAlice, AliceAddress, 1, WeiPerWad.mul(5), WeiPerWad.mul(6));
  // await wipeAndUnlockXDC(proxyWalletAsAlice, AliceAddress, 2, WeiPerWad.mul(5), WeiPerWad.mul(6));
  // await wipeAndUnlockXDC(proxyWalletAsAlice, AliceAddress, 3, WeiPerWad.mul(5), WeiPerWad.mul(6));

  // await lockXDCAndDraw(proxyWalletAsAlice, AliceAddress, 3, WeiPerWad.mul(0));

  //change price of XDC from 1 USD/XDC to 0.3 USD/XDC
  const simplePriceFeed = await getProxy(proxyFactory, "SimplePriceFeed");
  await simplePriceFeed.setPrice(WeiPerWad.div(2).toString());

  const priceOracle = await getProxy(proxyFactory, "PriceOracle");
  await priceOracle.setPrice(COLLATERAL_POOL_ID);
  //whiteList BobAddRess as liquidator
  const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
  await liquidationEngine.whitelist(BobAddress);
  //Bob sets liquidationEngineStrategy as FXD spender
  const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
  const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
  await fathomStablecoin.approve(fixedSpreadLiquidationStrategy.address, MaxUint256, { from: BobAddress, gasLimit: 2000000 });
  //Alice sends some FXD to Bob
  await fathomStablecoin.transfer(BobAddress, WeiPerWad.mul(20), { from: AliceAddress, gasLimit: 2000000 });
  var bobFXDBalance = await fathomStablecoin.balanceOf(BobAddress);
  console.log("Bob's FXD balance is "+ bobFXDBalance)
  //Bob liquidates the position
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const positionAddressToBeLiquidated = await positionManager.positions(1);
  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  await bookKeeper.whitelist(liquidationEngine.address, { from: BobAddress, gasLimit: 50000000});
  await bookKeeper.whitelist(fixedSpreadLiquidationStrategy.address, { from: BobAddress, gasLimit: 50000000});
  // const testCheck = await liquidationEngine.bookKeeper();
  // console.log(testCheck);
  const WXDC = await artifacts.initializeInterfaceAt("WXDC", "0xce75A95160D96F5388437993aB5825F322426E04");
  var bobWXDCBalance = await WXDC.balanceOf(BobAddress);
  console.log("Bob's WXDC balance is " + bobWXDCBalance);
  await liquidationEngine.liquidate(COLLATERAL_POOL_ID, positionAddressToBeLiquidated, WeiPerWad.mul(3), MaxUint256, BobAddress, "0x00",  { from: BobAddress, gasLimit: 50000000});
  // const wXDC = await artifacts.initializeInterfaceAt("WXDC", );
  bobFXDBalance = await fathomStablecoin.balanceOf(BobAddress);
  console.log("Bob's FXD balance is " + bobFXDBalance)
  bobWXDCBalance = await WXDC.balanceOf(BobAddress);
  console.log("Bob's WXDC balance is " + bobWXDCBalance);
};