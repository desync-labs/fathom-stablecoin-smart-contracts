task("stable-swap-info", "Stable Swap Info")
  .setAction(async () => {
    const flashMintModule = ethers.utils.getAddress("0xAa72C35f09E0bABBAF78DD8ccEeEA3F5a54E7664");
    const flashMintArbitrager = ethers.utils.getAddress("0x25464a1Cf25D1b180a36417fAB9FFd9960627860");
    const bookKeeperFlashMintArbitrager = ethers.utils.getAddress("0xf3D403DA1C8368Ce164dDA5bd316d582aC457a35");

    const stableSwap = await ethers.getContractAt("StableSwapModule", "0x42c06188B8C03769A1F73B3f31b259271ee3B981");
    const tvl = await stableSwap.totalValueLocked();
    const contractBalance = await ethers.provider.getBalance(stableSwap.address);
    console.log("TVL:", tvl);
    console.log("StableSwap Contract Balance:", contractBalance);


    const eventSignatureFlashLoan = "LogFlashLoan(address,address,uint256,uint256)";
    const eventTopicFlashLoan = ethers.utils.id(eventSignatureFlashLoan); // Get the data hex string

    const eventSignatureBookKeeperFlashLoan = "LogBookKeeperFlashLoan(address,uint256,uint256)";
    const eventTopicBookKeeperFlashLoan = ethers.utils.id(eventSignatureBookKeeperFlashLoan); // Get the data hex string
  
    const eventSignatureSwapTokenToStablecoin = "LogSwapTokenToStablecoin(address,uint256,uint256)";
    const eventTopicSwapTokenToStablecoin = ethers.utils.id(eventSignatureSwapTokenToStablecoin); // Get the data hex string

    const latestBlock = await hre.ethers.provider.getBlock("latest");
    console.log("Latest block", latestBlock.number);

    // const rawLogsFlashLoan = await ethers.provider.getLogs({
    //   address: flashMintModule,
    //   topics: [eventTopicFlashLoan],
    //   fromBlock: 0, 
    //   toBlock: latestBlock.number
    // });

    // const rawLogsBookKeeperFlashLoan = await ethers.provider.getLogs({
    //   address: flashMintModule,
    //   topics: [eventTopicBookKeeperFlashLoan],
    //   fromBlock: 0, 
    //   toBlock: latestBlock.number
    // });

    const rawLogsSwapTokenToStablecoin = await ethers.provider.getLogs({
      address: stableSwap.address,
      topics: [eventTopicSwapTokenToStablecoin],
      fromBlock: 0, 
      toBlock: latestBlock.number
    });

    // const abiFlashLoan = '[{"anonymous":false,"inputs":[{"indexed":true,"name":"_receiver","type":"address"},{"indexed":true,"name":"_token","type":"address"},{"indexed":false,"name":"_amount","type":"uint256"},{"indexed":false,"name":"_fee","type":"uint256"}],"name":"LogFlashLoan","type":"event"}]';
    // const intrfcFlashLoan = new ethers.utils.Interface(abiFlashLoan);

    // const abiBookKeeperFlashLoan = '[{"anonymous":false,"inputs":[{"indexed":true,"name":"_receiver","type":"address"},{"indexed":false,"name":"_amount","type":"uint256"},{"indexed":false,"name":"_fee","type":"uint256"}],"name":"LogBookKeeperFlashLoan","type":"event"}]';
    // const intrfcBookKeeperFlashLoan = new ethers.utils.Interface(abiBookKeeperFlashLoan);

    const abiSwapTokenToStablecoin = '[{"anonymous":false,"inputs":[{"indexed":true,"name":"_owner","type":"address"},{"indexed":false,"name":"_value","type":"uint256"},{"indexed":false,"name":"_fee","type":"uint256"}],"name":"LogSwapTokenToStablecoin","type":"event"}]';
    const intrfcSwapTokenToStablecoin = new ethers.utils.Interface(abiSwapTokenToStablecoin);

    // rawLogsFlashLoan.forEach((log) => {
    //   let parsedLog = intrfcFlashLoan.parseLog(log);
    //   console.log(`BEFORE PARSING:`);
    //   console.debug(log);
    //   console.log(`\n`);
      
    //   console.log(`AFTER PARSING:`);
    //   console.debug(parsedLog);
    //   console.log('************************************************');
    // });

    // rawLogsBookKeeperFlashLoan.forEach((log) => {
    //   let parsedLog = intrfcBookKeeperFlashLoan.parseLog(log);
    //   console.log(`BEFORE PARSING:`);
    //   console.debug(log);
    //   console.log(`\n`);
      
    //   console.log(`AFTER PARSING:`);
    //   console.debug(parsedLog);
    //   console.log('************************************************');
    // });

    rawLogsSwapTokenToStablecoin.forEach((log) => {
      let parsedLog = intrfcSwapTokenToStablecoin.parseLog(log);
      if (parsedLog.args._owner === flashMintArbitrager || parsedLog.args._owner === bookKeeperFlashMintArbitrager) {
        console.log(`BEFORE PARSING:`);
        console.debug(log);
        console.log(`\n`);
        
        console.log(`AFTER PARSING:`);
        console.debug(parsedLog);
        console.log('************************************************');
      }
    });
    console.log("Total swaps:", rawLogsSwapTokenToStablecoin.length);
  });

module.exports = {};
