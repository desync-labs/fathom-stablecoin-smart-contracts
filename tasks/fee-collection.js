const { getConfig } = require("../common/fee-collection-helper");

task("fee-collection", "Fee Collection").setAction(async () => {
  try {
    const config = getConfig(hre.network.config.chainId);
    if (!config) {
      throw new Error(`Configuration for network ID ${hre.network.config.chainId} not found`);
    }

    const systemDebtEngine = await ethers.getContractAt("SystemDebtEngine", config.SystemDebtEngine);
    const collateralTokenAdapter = await ethers.getContractAt("CollateralTokenAdapter", config.CollateralTokenAdapter);
    const flashMintModule = await ethers.getContractAt("FlashMintModule", config.FlashMintModule);
    const bookKeeper = await ethers.getContractAt("BookKeeper", config.BookKeeper);
    const stablecoinAdapter = ethers.getContractAt("StablecoinAdapter", config.StablecoinAdapter);
    const feeCollector = config.FeeCollector;
    const collateralPoolIds = config.CollateralPoolIds; // assuming you have this in config as an array
    const fathomStablecoin = await ethers.getContractAt("FathomStablecoin", config.FathomStablecoin);

    // Withdraw collateral surplus
    const withdrawCollateralSurplus = async (collateralPoolIds, to) => {
      for (const collateralPoolId of collateralPoolIds) {
        const collateralSurplus = await bookKeeper.collateralToken(collateralPoolId, systemDebtEngine.address);
        await systemDebtEngine.withdrawCollateralSurplus(collateralPoolId, to, collateralSurplus);
        if (collateralSurplus.gt(0)) {
          if (!(await collateralTokenAdapter.whitelisted(to))) {
            await collateralTokenAdapter.addToWhitelist(to);
          }
          await collateralTokenAdapter.withdraw(to, collateralSurplus, []);
        }
      }
    };

    // Withdraw stablecoin surplus
    const withdrawStablecoinSurplus = async () => {
      const flashMintFXDBalance = await fathomStablecoin.balanceOf(flashMintModule.address);
      if (flashMintFXDBalance.gt(0)) {
        await flashMintModule.convert();
      }

      const flashMintBookKeeperFXDBalance = await bookKeeper.stablecoin(flashMintModule.address);
      if (flashMintBookKeeperFXDBalance.gt(0)) {
        await flashMintModule.accrue();
      }

      const systemBadDebt = await bookKeeper.systemBadDebt(systemDebtEngine.address);
      const initialStablecoinSurplus = await bookKeeper.stablecoin(systemDebtEngine.address);

      if (initialStablecoinSurplus.gte(systemBadDebt)) {
        await systemDebtEngine.settleSystemBadDebt(systemBadDebt);
      } else {
        console.log("More debt than surplus, cannot settle system bad debt");
        return;
      }

      const stablecoinSurplus = await bookKeeper.stablecoin(systemDebtEngine.address);
      const surplusBuffer = await systemDebtEngine.surplusBuffer();

      if (stablecoinSurplus.gt(surplusBuffer)) {
        await systemDebtEngine.withdrawStablecoinSurplus(feeCollector, surplusBuffer);
        await stablecoinAdapter.withdraw(feeCollector, surplusBuffer, []);
      } else {
        console.log("Stablecoin surplus is less than the surplus buffer, no surplus to withdraw");
      }
    };

    await withdrawCollateralSurplus(collateralPoolIds, feeCollector);
    await withdrawStablecoinSurplus();

    console.log(`Finished`);
  } catch (error) {
    console.error(`Error during fee collection: ${error.message}`);
  }
});

module.exports = {};