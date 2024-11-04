task("position-info", "Get Position Info")
  .setAction(async () => {
    const COLLATERAL_POOL_ID = ethers.utils.formatBytes32String("XDC");
    const POSITION_ADDRESS = ethers.utils.getAddress("0xfed5ebff2d0604e61dea78522db97ba2c91f313f");
    const PRICE_FEED_ADDRESS = ethers.utils.getAddress("0xB7Bcc2A1B1bD61469b3c4dA32a76CA7E39fE8ac2");
    const PRICE_ORACLE_ADDRESS = ethers.utils.getAddress("0xF557fBf34B785b157344167fE0D9bAb95da06843");
    const POSITION_ID = 635;
    const POSITION_OWNER = ethers.utils.getAddress("0x9ab4C8c17d7964Dc7eB81d73E236F53264bd32d1");
    const bookKeeper = await ethers.getContractAt("BookKeeper", "0x6FD3f049DF9e1886e1DFc1A034D379efaB0603CE");
    const positionManager = await ethers.getContractAt("PositionManager", "0x2fE84707e907eaB4C4E6a91CCe458E648be390Ae");
    const collateralPoolConfig = await ethers.getContractAt("CollateralPoolConfig", "0x4F5Ea639600A01931B1370CDe99a7B1e7b6b8f6C");
    const fixedSpread = await ethers.getContractAt("FixedSpreadLiquidationStrategy", "0xfe5037504E0EF5eC2DfBEEA03f9d9cB43580EF23");
    const accessControlConfig = await ethers.getContractAt("AccessControlConfig", "0x2cD89769a2D9d992790e76c6A9f55c39fdf2FDc2");
    const delayPriceFeed = await ethers.getContractAt("DelayFathomOraclePriceFeed", PRICE_FEED_ADDRESS);
    const centralizedPriceFeed = await ethers.getContractAt("CentralizedOraclePriceFeed", PRICE_FEED_ADDRESS);
    const pricaOracle = await ethers.getContractAt("PriceOracle", PRICE_ORACLE_ADDRESS);

    const FLASH_LIQUIDATOR_ADDRESS = ethers.utils.getAddress("0x5cF8e2326F5c013d568F48E878e9D7ae9557F902");
    const FLASH_LIQUIDATOR_ADDRESS2 = ethers.utils.getAddress("0x1539D939b87392e542d3F968Ce6a7E354CEB996C");

    const position = await bookKeeper.positions(COLLATERAL_POOL_ID, POSITION_ADDRESS);
    console.log("Last Position ID", await positionManager.lastPositionId());
    console.log("Position Locked collateral", position.lockedCollateral);
    console.log("Position Debt Share", position.debtShare);
    console.log("Position Address", POSITION_ADDRESS);
    console.log("Position ID", POSITION_ID);
    console.log("Position Owner", POSITION_OWNER);

    console.log(`Getting the LiquidationFail events...`);

    const eventSignatureLiquidationFail = "LiquidationFail(bytes32,address,address,string)";    
    const eventTopicLiqFail = ethers.utils.id(eventSignatureLiquidationFail); // Get the data hex string

    const eventSignatureOpenPos = "LogNewPosition(address,address,uint256)";    
    const eventTopicOpenPos = ethers.utils.id(eventSignatureOpenPos); // Get the data hex string

    const eventSignatureAdjPos = "LogAdjustPosition(address,bytes32,address,uint256,uint256,uint256,int256,int256)";    
    const eventTopicAdjPos = ethers.utils.id(eventSignatureAdjPos); // Get the data hex string

    const eventSignatureFixSLiq = "LogFixedSpreadLiquidate(bytes32,uint256,uint256,address,uint256,uint256,address,address,uint256,uint256,uint256,uint256)";    
    const eventTopicFixSLiq = ethers.utils.id(eventSignatureFixSLiq); // Get the data hex string

    const eventSignatureFlashLen = "LogSetFlashLendingEnabled(address,bool)";    
    const eventTopicFlashLen = ethers.utils.id(eventSignatureFlashLen); // Get the data hex string

    const eventSignatureRoleGrant = "RoleGranted(bytes32,address,address)";    
    const eventTopicRoleGrant = ethers.utils.id(eventSignatureRoleGrant); // Get the data hex string

    const eventSignatureDebtAcc = "LogSetDebtAccumulatedRate(address,bytes32,uint256)";    
    const eventTopicDebtAcc = ethers.utils.id(eventSignatureDebtAcc); // Get the data hex string

    const eventSignatureCloseFact = "LogSetCloseFactorBps(address,bytes32,uint256)";    
    const eventTopicDebtCloseFact = ethers.utils.id(eventSignatureCloseFact); // Get the data hex string

    // check set debt floor events 

    const latestBlock = await hre.ethers.provider.getBlock("latest");
    console.log("Latest block", latestBlock.number);

    const rawLogsLiqFail = await ethers.provider.getLogs({
      address: "0x6Af7c469CD476aa7b5Cf5e486CfC8260814c244C",
      topics: [eventTopicLiqFail],
      fromBlock: 70000000, 
      toBlock: 80000000
    });

    // const rawLogsOpenPos = await ethers.provider.getLogs({
    //   address: "0x2fE84707e907eaB4C4E6a91CCe458E648be390Ae",
    //   topics: [eventTopicOpenPos],
    //   fromBlock: 70000000, 
    //   toBlock: 81140017
    // });

    // const rawLogsAdjPos = await ethers.provider.getLogs({
    //   address: "0x6FD3f049DF9e1886e1DFc1A034D379efaB0603CE",
    //   topics: [eventTopicAdjPos],
    //   fromBlock: 70000000, 
    //   toBlock: 81140017
    // });

    // const rawLogsFixSLiq = await ethers.provider.getLogs({
    //   address: "0xfe5037504E0EF5eC2DfBEEA03f9d9cB43580EF23",
    //   topics: [eventTopicFixSLiq],
    //   fromBlock: 70000000, 
    //   // toBlock: 81202538
    //   toBlock: 81202538
    // });

    // const rawLogsFlashLen = await ethers.provider.getLogs({
    //   address: "0xfe5037504E0EF5eC2DfBEEA03f9d9cB43580EF23",
    //   topics: [eventTopicFlashLen],
    //   fromBlock: 60000000, 
    //   toBlock: 80000000
    // });

    // const rawLogsRoleGrant = await ethers.provider.getLogs({
    //   address: "0x2cD89769a2D9d992790e76c6A9f55c39fdf2FDc2",
    //   topics: [eventTopicRoleGrant],
    //   fromBlock: 50000000, 
    //   toBlock: 70000000
    // });

    // const rawLogsDebtAcc = await ethers.provider.getLogs({
    //   address: "0x4F5Ea639600A01931B1370CDe99a7B1e7b6b8f6C",
    //   topics: [eventTopicDebtAcc],
    //   fromBlock: 60000000, 
    //   toBlock: 80000000
    // });

    // const rawLogsCloseFact = await ethers.provider.getLogs({
    //   address: "0x4F5Ea639600A01931B1370CDe99a7B1e7b6b8f6C",
    //   topics: [eventTopicDebtCloseFact],
    //   fromBlock: 0, 
    //   toBlock: 80000000
    // });

    const abiLiqEng = '[{"anonymous":false,"inputs":[{"indexed":false,"name":"_collateralPoolIds","type":"bytes32"},{"indexed":false,"name":"_positionAddresses","type":"address"},{"indexed":false,"name":"_liquidator","type":"address"},{"indexed":false,"name":"reason","type":"string"}],"name":"LiquidationFail","type":"event"}]';
    const intrfcLiqEng = new ethers.utils.Interface(abiLiqEng);

    const abiBookKeeper = '[{"anonymous":false,"inputs":[{"indexed":true,"name":"_caller","type":"address"},{"indexed":true,"name":"_collateralPoolId","type":"bytes32"},{"indexed":true,"name":"_positionAddress","type":"address"},{"indexed":false,"name":"_lockedCollateral","type":"uint256"},{"indexed":false,"name":"_debtShare","type":"uint256"},{"indexed":false,"name":"_positionDebtValue","type":"uint256"},{"indexed":false,"name":"_addCollateral","type":"int256"},{"indexed":false,"name":"_addDebtShare","type":"int256"}],"name":"LogAdjustPosition","type":"event"}]';
    const intrfcBkkpr = new ethers.utils.Interface(abiBookKeeper);

    const abiPosMan = '[{"anonymous":false,"inputs":[{"indexed":true,"name":"_usr","type":"address"},{"indexed":true,"name":"_own","type":"address"},{"indexed":true,"name":"_positionId","type":"uint256"}],"name":"LogNewPosition","type":"event"}]';
    const intrfcPosMan = new ethers.utils.Interface(abiPosMan);

    const abiFixS = '[{"anonymous":false,"inputs":[{"indexed":true,"name":"_collateralPoolId","type":"bytes32"},{"indexed":false,"name":"_positionDebtShare","type":"uint256"},{"indexed":false,"name":"_positionCollateralAmount","type":"uint256"},{"indexed":true,"name":"_positionAddress","type":"address"},{"indexed":false,"name":"_debtShareToBeLiquidated","type":"uint256"},{"indexed":false,"name":"_maxDebtShareToBeLiquidated","type":"uint256"},{"indexed":true,"name":"_liquidatorAddress","type":"address"},{"indexed":false,"name":"_collateralRecipient","type":"address"},{"indexed":false,"name":"_actualDebtShareToBeLiquidated","type":"uint256"},{"indexed":false,"name":"_actualDebtValueToBeLiquidated","type":"uint256"},{"indexed":false,"name":"_collateralAmountToBeLiquidated","type":"uint256"},{"indexed":false,"name":"_treasuryFees","type":"uint256"}],"name":"LogFixedSpreadLiquidate","type":"event"}]';
    const intrfcFixS = new ethers.utils.Interface(abiFixS);

    const abiFlashLen = '[{"anonymous":false,"inputs":[{"indexed":true,"name":"_caller","type":"address"},{"indexed":false,"name":"_flashLendingEnabled","type":"bool"}],"name":"LogSetFlashLendingEnabled","type":"event"}]';
    const intrfcFlashLen = new ethers.utils.Interface(abiFlashLen);

    //  event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);

    const abiRoleGrant = '[{"anonymous":false,"inputs":[{"indexed":true,"name":"role","type":"bytes32"},{"indexed":true,"name":"account","type":"address"},{"indexed":true,"name":"sender","type":"address"}],"name":"RoleGranted","type":"event"}]';
    const intrfcRoleGrant = new ethers.utils.Interface(abiRoleGrant);

    const abiDebtAcc = '[{"anonymous":false,"inputs":[{"indexed":true,"name":"_caller","type":"address"},{"indexed":true,"name":"_collateralPoolId","type":"bytes32"},{"indexed":false,"name":"_debtAccumulatedRate","type":"uint256"}],"name":"LogSetDebtAccumulatedRate","type":"event"}]';
    const intrfcDebtAcc = new ethers.utils.Interface(abiDebtAcc);

    const abiCloseFact = '[{"anonymous":false,"inputs":[{"indexed":true,"name":"_caller","type":"address"},{"indexed":true,"name":"_collateralPoolId","type":"bytes32"},{"indexed":false,"name":"_closeFactorBps","type":"uint256"}],"name":"LogSetCloseFactorBps","type":"event"}]';
    const intrfcCloseFact = new ethers.utils.Interface(abiCloseFact);
    
    
    for (let i = 0; i < rawLogsLiqFail.length; i++) {
      const parsedLog = intrfcLiqEng.parseLog(rawLogsLiqFail[i]);
      if (parsedLog.args._positionAddresses === POSITION_ADDRESS) {
        console.log(`BEFORE PARSING:`);
        console.debug(rawLogsLiqFail[i]);
        console.log(`\n`);
  
        console.log(`AFTER PARSING:`);
        console.debug(parsedLog);
        console.log('************************************************');
        // break;
      }
    }

    // rawLogsOpenPos.forEach((log) => {
    //   let parsedLog = intrfcPosMan.parseLog(log);
    //   if (parsedLog.args._positionId.toString() === POSITION_ID.toString()) {
    //     console.log(`BEFORE PARSING:`);
    //     console.debug(log);
    //     console.log(`\n`);
        
    //     console.log(`AFTER PARSING:`);
    //     console.debug(parsedLog);
    //     console.log('************************************************');
    //   }
    // })

    // rawLogsAdjPos.forEach((log) => {
    //   let parsedLog = intrfcBkkpr.parseLog(log);
    //   if (parsedLog.args._positionAddress === POSITION_ADDRESS) {
    //     console.log(`BEFORE PARSING:`);
    //     console.debug(log);
    //     console.log(`\n`);
        
    //     console.log(`AFTER PARSING:`);
    //     console.debug(parsedLog);
    //     console.log('************************************************');
    //   }
    // })

    // console.log(`Getting the FixedSpreadLiquidate events...`, rawLogsFixSLiq.length);

    // rawLogsFixSLiq.forEach((log) => {
    //   let parsedLog = intrfcFixS.parseLog(log);
    //   if (parsedLog.args._collateralRecipient === FLASH_LIQUIDATOR_ADDRESS2) {
    //     console.log(`BEFORE PARSING:`);
    //     console.debug(log);
    //     console.log(`\n`);
        
    //     console.log(`AFTER PARSING:`);
    //     console.debug(parsedLog);
    //     console.log('************************************************');
    //   }
    // })

    // rawLogsFlashLen.forEach((log) => {
    //   let parsedLog = intrfcFlashLen.parseLog(log);
    //   console.log(`BEFORE PARSING:`);
    //   console.debug(log);
    //   console.log(`\n`);
        
    //   console.log(`AFTER PARSING:`);
    //   console.debug(parsedLog);
    //   console.log('************************************************');
    // })

    // rawLogsRoleGrant.forEach((log) => {
    //   let parsedLog = intrfcRoleGrant.parseLog(log);
    //   console.log(`BEFORE PARSING:`);
    //   console.debug(log);
    //   console.log(`\n`);
        
    //   console.log(`AFTER PARSING:`);
    //   console.debug(parsedLog);
    //   console.log('************************************************');
    // })

    // rawLogsDebtAcc.forEach((log) => {
    //   let parsedLog = intrfcDebtAcc.parseLog(log);
    //   if (parsedLog.args._debtAccumulatedRate.toString() == "0") {
    //     console.log(`BEFORE PARSING:`);
    //     console.debug(log);
    //     console.log(`\n`);
        
    //     console.log(`AFTER PARSING:`);
    //     console.debug(parsedLog);
    //     console.log('************************************************');
    //   }
    // })

    // rawLogsCloseFact.forEach((log) => {
    //   let parsedLog = intrfcCloseFact.parseLog(log);
    //   // if (parsedLog.args._debtAccumulatedRate.toString() == "0") {
    //     console.log(`BEFORE PARSING:`);
    //     console.debug(log);
    //     console.log(`\n`);
        
    //     console.log(`AFTER PARSING:`);
    //     console.debug(parsedLog);
    //     console.log('************************************************');
    //   // }
    // })

    console.log("Flash Lending enabled", await fixedSpread.flashLendingEnabled())
    console.log("Debt accumulated rate", await collateralPoolConfig.getDebtAccumulatedRate(COLLATERAL_POOL_ID));
    console.log("Close factor bps", await collateralPoolConfig.getCloseFactorBps(COLLATERAL_POOL_ID));
    console.log("Liquidator incentive bps", await collateralPoolConfig.getLiquidatorIncentiveBps(COLLATERAL_POOL_ID));
    console.log("Debt floor", await collateralPoolConfig.getDebtFloor(COLLATERAL_POOL_ID));
    console.log("Teasury fees bps", await collateralPoolConfig.getTreasuryFeesBps(COLLATERAL_POOL_ID));
    console.log("Centralized Price", await centralizedPriceFeed.readPrice());
    console.log("Delayed Price", await delayPriceFeed.readPrice());
    console.log("Reference Price", await pricaOracle.stableCoinReferencePrice());
    const OWNER_ROLE = ethers.utils.formatBytes32String("OWNER_ROLE")
    console.log("AccessControlConfig", await accessControlConfig.hasRole(await accessControlConfig.OWNER_ROLE(), "0x594D425a6C9249F66a00C841A7a2A921b63a0a4C"));
    const stabRefPrice = await pricaOracle.stableCoinReferencePrice();
    const dealyedPrice = await delayPriceFeed.readPrice();
    const RAY = "1000000000000000000000000000"
    const totalP = dealyedPrice.mul("1000000000").mul(RAY).div(stabRefPrice)
    console.log("total p", totalP.mul("50"))
    const nmnbr = ethers.BigNumber.from("1030572256701337218005159609");
    console.log("total G", nmnbr.mul("10500").div("10000").div("26867099999999998"))
  });

module.exports = {};
