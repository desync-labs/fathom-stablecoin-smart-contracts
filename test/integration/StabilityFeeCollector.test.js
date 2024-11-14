const { ethers } = require("hardhat");
const provider = ethers.provider;
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

const { BigNumber } = ethers;

const { WeiPerRay, WeiPerWad } = require("../helper/unit");
const AssertHelpers = require("../helper/assert");
const { createProxyWallets } = require("../helper/proxy-wallets");
const PositionHelper = require("../helper/positions");
const { getProxy } = require("../../common/proxies");
const pools = require("../../common/collateral");

const MIN_DELAY = 3600; // 1 hour
const VOTING_PERIOD = 50400; // This is how long voting lasts, 1 week
const VOTING_DELAY = 1; // How many blocks till a proposal vote becomes active
const VOTE_WAY = 1;

describe("Stability Fee", () => {
  // Proxy wallet
  let aliceProxyWallet;

  // Contract
  let positionManager;
  let bookKeeper;
  // let tokenAdapter
  let stablecoinAdapter;
  let stabilityFeeCollector;
  let collateralPoolConfig;
  let simplePriceFeed;
  let governor;

  let DeployerAddress;
  let AliceAddress;
  let DevAddress;

  beforeEach(async () => {
    await deployments.fixture(["DeployTestFixture"]);

    const { allice, dev } = await getNamedAccounts();
    AliceAddress = allice;
    DevAddress = dev;

    const ProxyFactory = await deployments.get("FathomProxyFactory");
    const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
    const SimplePriceFeed = await deployments.get("SimplePriceFeed");
    simplePriceFeed = await ethers.getContractAt("SimplePriceFeed", SimplePriceFeed.address);

    const Governor = await deployments.get("ProtocolGovernor");
    governor = await ethers.getContractAt("ProtocolGovernor", Governor.address);

    collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
    bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
    positionManager = await getProxy(proxyFactory, "PositionManager");
    stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");

    const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");

    let values = [0, 0, 0];
    let targets = [proxyWalletRegistry.address, stabilityFeeCollector.address, collateralPoolConfig.address];
    let calldatas = [
      proxyWalletRegistry.interface.encodeFunctionData("setDecentralizedMode", [true]),
      stabilityFeeCollector.interface.encodeFunctionData("setSystemDebtEngine", [DevAddress]),
      collateralPoolConfig.interface.encodeFunctionData("setStabilityFeeRate", [pools.XDC, BigNumber.from("1000000005781378656804591713")]),
    ];
    let proposalTx = await governor.propose(targets, values, calldatas, "Setup");
    let proposalReceipt = await proposalTx.wait();
    let proposalId = proposalReceipt.events[0].args.proposalId;

    await mine(VOTING_DELAY + 1); // wait for the voting period to pass

    await governor.connect(provider.getSigner(DeployerAddress)).castVote(proposalId, VOTE_WAY);

    await mine(VOTING_PERIOD + 1);

    // Queue the TX
    let descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Setup"));
    await governor.queue(targets, values, calldatas, descriptionHash);

    await time.increase(MIN_DELAY + 1);
    await mine(1);

    await governor.execute(targets, values, calldatas, descriptionHash);
    // await proxyWalletRegistry.setDecentralizedMode(true);

    // ({
    //   proxyWallets: [aliceProxyWallet],
    // } = await createProxyWallets([AliceAddress]));

    await proxyWalletRegistry.build(AliceAddress);
    const proxyWalletAddress = await proxyWalletRegistry.proxies(AliceAddress);
    aliceProxyWallet = await ethers.getContractAt("ProxyWallet", proxyWalletAddress);

    // await stabilityFeeCollector.setSystemDebtEngine(DevAddress);

    await fathomStablecoin.connect(provider.getSigner(AliceAddress)).approve(aliceProxyWallet.address, WeiPerWad.mul(10000));
  });

  describe("#collect", () => {
    context("when call collect directly and call deposit", () => {
      it.only("should be success", async () => {
        // await collateralPoolConfig.setStabilityFeeRate(pools.XDC, BigNumber.from("1000000005781378656804591713"));

        // time increase 6 month
        await time.increase(15768000);
        let values = [0];
        let targets = [simplePriceFeed.address];
        let calldatas = [simplePriceFeed.interface.encodeFunctionData("setPrice", [WeiPerRay])];
        let proposalTx = await governor.propose(targets, values, calldatas, "Setup");
        let proposalReceipt = await proposalTx.wait();
        let proposalId = proposalReceipt.events[0].args.proposalId;

        await mine(VOTING_DELAY + 1); // wait for the voting period to pass

        await governor.connect(provider.getSigner(DeployerAddress)).castVote(proposalId, VOTE_WAY);

        await mine(VOTING_PERIOD + 1);

        // Queue the TX
        let descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Setup"));
        await governor.queue(targets, values, calldatas, descriptionHash);

        await time.increase(MIN_DELAY + 1);
        await mine(1);

        await governor.execute(targets, values, calldatas, descriptionHash);
        // await simplePriceFeed.setPrice(WeiPerRay);
        await stabilityFeeCollector.collect(pools.XDC);
        const debtAccumulatedRate = await collateralPoolConfig.collateralPools(pools.XDC);
        // debtAccumulatedRate = RAY(1000000005781378656804591713^15768000) = 1095445115010332226911367294
        AssertHelpers.assertAlmostEqual(debtAccumulatedRate.debtAccumulatedRate.toString(), "1095445115010332226911367294");
        AssertHelpers.assertAlmostEqual((await bookKeeper.stablecoin(DevAddress)).toString(), "0");

        // // position 1
        // //  a. open a new position
        // //  b. lock WXDC
        // //  c. mint FXD
        // await PositionHelper.openXDCPositionAndDraw(aliceProxyWallet, AliceAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5));
        // const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address);
        // const positionAddress = await positionManager.positions(positionId);

        // // position debtShare = 5000000000000000000000000000000000000000000000 / 1095445115010332226911367294 = 4564354645876384278
        // AssertHelpers.assertAlmostEqual((await bookKeeper.positions(pools.XDC, positionAddress)).debtShare.toString(), "4564354645876384278");
        // AssertHelpers.assertAlmostEqual((await collateralPoolConfig.collateralPools(pools.XDC)).totalDebtShare.toString(), "4564354645876384278");
        // AssertHelpers.assertAlmostEqual(
        //   (await collateralPoolConfig.collateralPools(pools.XDC)).debtAccumulatedRate.toString(),
        //   "1095445115010332226911367294"
        // );

        // // time increase 1 year
        // await time.increase(31536000);
        // await simplePriceFeed.setPrice(WeiPerRay);

        // // position 2
        // //  a. open a new position
        // //  b. lock WXDC
        // //  c. mint FXD
        // await PositionHelper.openXDCPositionAndDraw(aliceProxyWallet, AliceAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5));

        // const positionId2 = await positionManager.ownerLastPositionId(aliceProxyWallet.address);
        // const positionAddress2 = await positionManager.positions(positionId2);

        // // debtAccumulatedRate = RAY((1000000005781378656804591713^31536000) * 1095445115010332226911367294) = 1314534138012398672287467301
        // AssertHelpers.assertAlmostEqual(
        //   (await collateralPoolConfig.collateralPools(pools.XDC)).debtAccumulatedRate.toString(),
        //   "1314534138012398672287467301"
        // );
        // // debtShare * diffDebtAccumulatedRate =  4564354645876384278 * (1314534138012398672287467301 - 1095445115010332226911367294) = 999999999999999999792432233173942358090489946
        // AssertHelpers.assertAlmostEqual((await bookKeeper.stablecoin(DevAddress)).toString(), "999999999999999999792432233173942358090489946");

        // // position debtShare = 5000000000000000000000000000000000000000000000 / 1314534138012398672287467301 = 3803628871563653565
        // AssertHelpers.assertAlmostEqual((await bookKeeper.positions(pools.XDC, positionAddress2)).debtShare.toString(), "3803628871563653565");
        // // 4564354645876384278 + 3803628871563653565 = 8367983517440037843
        // AssertHelpers.assertAlmostEqual((await collateralPoolConfig.collateralPools(pools.XDC)).totalDebtShare.toString(), "8367983517440037843");

        // // time increase 1 year
        // await time.increase(31536000);
        // await simplePriceFeed.setPrice(WeiPerRay);

        // // debtAccumulatedRate ~ 20%
        // await stabilityFeeCollector.collect(pools.XDC);

        // // debtAccumulatedRate = RAY((1000000005781378656804591713^31536000) * 1314534138012398672287467301) = 1577440965614878406737552619
        // AssertHelpers.assertAlmostEqual(
        //   (await collateralPoolConfig.collateralPools(pools.XDC)).debtAccumulatedRate.toString(),
        //   "1577440965614878406737552619"
        // );
        // // debtShare * diffDebtAccumulatedRate =  8367983517440037843 * (1577440965614878406737552619 - 1314534138012398672287467301) = 2199999999999999999533019044066331740498689074
        // // 2199999999999999999533019044066331740498689074 + 999999999999999999792432233173942358090489946 = 3199999999999999999325451277240274098589179020
        // AssertHelpers.assertAlmostEqual((await bookKeeper.stablecoin(DevAddress)).toString(), "3199999999999999999325451277240274098589179020");

        // //  a. repay some FXD
        // //  b. alice unlock some WXDC
        // await PositionHelper.wipeAndUnlockXDC(aliceProxyWallet, AliceAddress, positionId, WeiPerWad, WeiPerWad);

        // AssertHelpers.assertAlmostEqual(
        //   (await collateralPoolConfig.collateralPools(pools.XDC)).debtAccumulatedRate.toString(),
        //   "1577440965614878406737552619"
        // );
        // AssertHelpers.assertAlmostEqual((await bookKeeper.stablecoin(DevAddress)).toString(), "3199999999999999999325451277240274098589179020");
      });
    });
  });
});
