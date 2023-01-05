deploy:
	# rm -r build
	# rm addresses.json
	coralX compile
# deploy accessControl
	coralX execute --network development --path scripts/deployment/0_access-control-config/deploy/deploy_accessControlConfig.js
	coralX execute --network development --path scripts/deployment/0_access-control-config/initialize/initialize_accessControlConfig.js
# deploy collateralPoolConfig
	coralX execute --network development --path scripts/deployment/1_collateral-pool-config/deploy/collateral-pool-config.js
	coralX execute --network development --path scripts/deployment/1_collateral-pool-config/initialize/initialize_collateralPoolConfig.js
# deploy bookKeeper
	coralX execute --network development --path scripts/deployment/2_book-keeper/deploy/book-keeper.js
	coralX execute --network development --path scripts/deployment/2_book-keeper/initialize/initialize_book-keeper.js
# deploy FXD, recorded as fathomStablecoin in addresses.json
	coralX execute --network development --path scripts/deployment/3_fathom-stablecoin/deploy/fathom-stablecoin.js
	coralX execute --network development --path scripts/deployment/3_fathom-stablecoin/initialize/initialize_fathom-stablecoin.js
# deploy systemDebtEngine
	coralX execute --network development --path scripts/deployment/4_system-debt-engine/deploy/system-debt-engine.js
	coralX execute --network development --path scripts/deployment/4_system-debt-engine/initialize/initialize_system-debt-engine.js
# deploy priceOracle
	coralX execute --network development --path scripts/deployment/7_price-oracle/deploy/price-oracle.js
	coralX execute --network development --path scripts/deployment/7_price-oracle/initialize/initialize_price-oracle.js
# deploy liquidationEngine
	coralX execute --network development --path scripts/deployment/5_liquidation-engine/deploy/liquidation-engine.js
	coralX execute --network development --path scripts/deployment/5_liquidation-engine/initialize/initialize_liquidation-engine.js
# deploy stablecoinAdapter
	coralX execute --network development --path scripts/deployment/6_stablecoin-adapter/deploy/stablecoin-adapter.js

	coralX execute --network development --path scripts/deployment/6_stablecoin-adapter/initialize/initialize_stablecoin-adapter.js
# deploy showStopper
	coralX execute --network development --path scripts/deployment/8_show-stopper/deploy/show-stopper.js
	coralX execute --network development --path scripts/deployment/8_show-stopper/initialize/initialize_show-stopper.js
# deploy fathomToken
	# coralX execute --network development --path scripts/deployment/9_fathom-token/deploy/fathom-token.js
# deploy fairLaunch
	# coralX execute --network development --path scripts/deployment/10_fair-launch/deploy/fair-launch.js
# deploy WXDC
	# coralX execute --network development --path scripts/deployment/11_WXDC/deploy/WXDC.js
	# coralX execute --network development --path scripts/deployment/11_WXDC/initialize/initialize_WXDC.js
# # deploy USDT
	coralX execute --network development --path scripts/deployment/22_USDT-mock/deploy/USDT.js
	coralX execute --network development --path scripts/deployment/22_USDT-mock/initialize/initialize_USDT.js
# deploy shield
	# coralX execute --network development --path scripts/deployment/12_shield/deploy/shield.js
# config fairLaunch
	# coralX execute --network development --path scripts/deployment/10_fair-launch/config/fair-launch-config.js
# deployPositonManager
	coralX execute --network development --path scripts/deployment/13_position-manager/deploy/position-manager.js
	coralX execute --network development --path scripts/deployment/13_position-manager/initialize/initialize_position-manager.js
# collateralTokenAdapter
	# coralX execute --network development --path scripts/deployment/14_collateral-token-adapter/deploy/collateral-token-adapter.js
	# coralX execute --network development --path scripts/deployment/14_collateral-token-adapter/initialize/initialize_collateral-token-adapter.js
# ankrCollateralAdapter
	coralX execute --network development --path scripts/deployment/35_ankr-collateral-adapter/deploy/ankr-collateral-adapter.js
# deploy simplePriceFeeds
	coralX execute --network development --path scripts/deployment/15_simple-price-feed/deploy/simple-price-feed.js
	# coralX execute --network development --path scripts/deployment/15_simple-price-feed/deploy/simple-price-feed-USDT.js
	# coralX execute --network development --path scripts/deployment/15_simple-price-feed/deploy/simple-price-feed-USDT-COL.js
	# coralX execute --network development --path scripts/deployment/15_simple-price-feed/deploy/simple-price-feed-FTHM.js
# initialize simplePriceFeeds
	coralX execute --network development --path scripts/deployment/15_simple-price-feed/initialize/initialize_simple-price-feed.js

	# coralX execute --network development --path scripts/deployment/15_simple-price-feed/initialize/initialize_simple-price-feed-USDT.js
	# coralX execute --network development --path scripts/deployment/15_simple-price-feed/initialize/initialize_simple-price-feed-USDT-COL.js
	# coralX execute --network development --path scripts/deployment/15_simple-price-feed/initialize/initialize_simple-price-feed-FTHM.js
# deploy FSL strategy
	coralX execute --network development --path scripts/deployment/16_fixed-spread-liquidation-strategy/deploy/fixed-spread-liquidation-strategy.js
	coralX execute --network development --path scripts/deployment/16_fixed-spread-liquidation-strategy/initialize/initialize_fixed-spread-liquidation-strategy.js
# grant Price Oracle role to PriceOracle
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-price-oracle-role.js

# deploy MockaXDCc
	coralX execute --network development --path scripts/deployment/33_mock-aXDCc/deploy/mock-aXDCc.js
# deploy MockXDCStakingPool
	coralX execute --network development --path scripts/deployment/34_mock-ankrStakingPool/deploy/mock-ankrStakingPool.js
# init ankrCollateralAdapter
	coralX execute --network development --path scripts/deployment/35_ankr-collateral-adapter/initialize/initialize_ankr-collateral-adapter.js
# config collateralPoolConfig
	coralX execute --network development --path scripts/deployment/1_collateral-pool-config/config/collateral-pool-config.js
# debtCeiling:
# 	coralX execute --network development --path scripts/deployment/1_collateral-pool-config/config/setDebtCeiling.js

# deploy proxyActions
	coralX execute --network development --path scripts/deployment/17_proxy-actions/deploy/proxy-actions.js
# deploy stabilityFeeCollector
	coralX execute --network development --path scripts/deployment/18_stability-fee-collector/deploy/stability-fee-collector.js
	coralX execute --network development --path scripts/deployment/18_stability-fee-collector/initialize/initialize_stability-fee-collector.js
# deploy proxyWalletFactory
	coralX execute --network development --path scripts/deployment/19_proxy-wallet-factory/deploy/proxy-wallet-factory.js
# deploy proxyWalletRegistry
	coralX execute --network development --path scripts/deployment/20_proxy-wallet-registry/deploy/proxy-wallet-registry.js
	coralX execute --network development --path scripts/deployment/20_proxy-wallet-registry/initialize/initialize_proxy-wallet-registry.js
# deploy authTokenAdapter
	coralX execute --network development --path scripts/deployment/23_auth-token-adapter/deploy/auth-token-adapter.js
	coralX execute --network development --path scripts/deployment/23_auth-token-adapter/initialize/initialize_auth-token-adapter.js
# deploy stableSwapModule
	coralX execute --network development --path scripts/deployment/24_stable-swap-module/deploy/stable-swap-module.js
	coralX execute --network development --path scripts/deployment/24_stable-swap-module/initialize/initialize_stable-swap-module.js
# deploy getPositions
	# coralX execute --network development --path scripts/deployment/25_get-positions/deploy/get-positions.js

	# coralX execute --network development --path scripts/deployment/25_get-positions/initialize/initialize_get-positions.js
# whiteList StableSwapModule to authTokenAdapter
	coralX execute --network development --path scripts/deployment/23_auth-token-adapter/config/auth-token-adapter-whitelist.js
# grant ADAPTER_ROLE() to collateralTokenAdapter
	# coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role.js
# grant ADAPTER_ROLE() to ankrCollateralAdapter
	# fill this in Sangjun for depositing XDC to ankr test
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role-ankr.js

# grant ADAPTER_ROLE() to authTokenAdapter
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-auth-token-adapter-role.js
# grant BOOK_KEEPER_ROLE() to bookKeeper
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-book-keeper-role.js
# grant COLLATERAL_MANAGER_ROLE() to fixedSpreadLiquidationStrategy/positionManager/stableSwapModule
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-collateral-manager-role.js
# grant GOV_ROLE() to systemAccount
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-gov-role.js

# grant LIQUIDATION_ENGINE_ROLE() to LIQUIDATION_ENGINE_ADDR
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-liquidation-engine-role.js
# grant LIQUIDATION_ENGINE_ROLE() to LIQUIDATION_STRATEGY_ADDR

	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-liquidation-strategy-role.js
# skip granting MINTABLE_ROLE() to flashMintModule
	# coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-mintable-role.js

# grant POSITION_MANAGER_ROLE to POSITION_MANAGER_ADDR & STABLE_SWAP_MODULE_ADDR
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-position-manager-role.js
# grant SHOW_STOPPER_ROLE() to SHOW_STOPPER_ADDR
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-show-stopper-role.js
# grant STABILITY_FEE_COLLECTOR_ROLE() to stabilityFeeCollector
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-stability-fee-collector-role.js
# grant MINTER_ROLE() to STABLECOIN_ADAPTER_ADDR
	coralX execute --network development --path scripts/deployment/3_fathom-stablecoin/config/grant-minter-role.js
# setTotalDebtCeiling for bookKeeper
	coralX execute --network development --path scripts/deployment/2_book-keeper/config/set-total-debt-ceiling.js
# set fee in for SSM
	coralX execute --network development --path scripts/deployment/24_stable-swap-module/config/set-fee-in.js
# set fee out for SSM	
	coralX execute --network development --path scripts/deployment/24_stable-swap-module/config/set-fee-out.js
# whiteList collateralTokenAdapter to bookKeeper
	# coralX execute --network development --path scripts/deployment/2_book-keeper/config/whitelist-collateral-token-adapter.js

# whiteList ankrCollateralAdapter to bookKeeper
	# coralX execute --network development --path scripts/deployment/2_book-keeper/config/whitelist-collateral-token-adapter-ankr.js

# deploy collateralTokenAdapter for USDT-STABLE, FTHM, USDT-COL
	# coralX execute --network development --path scripts/deployment/14_collateral-token-adapter/deploy/collateral-token-adapter-USDT.js
	# coralX execute --network development --path scripts/deployment/14_collateral-token-adapter/initialize/initialize_collateral-token-adapter-USDT.js

	# coralX execute --network development --path scripts/deployment/14_collateral-token-adapter/deploy/collateral-token-adapter-FTHM.js
	# coralX execute --network development --path scripts/deployment/14_collateral-token-adapter/initialize/initialize_collateral-token-adapter-FTHM.js

	# coralX execute --network development --path scripts/deployment/14_collateral-token-adapter/deploy/collateral-token-adapter-USDT-COL.js
	# coralX execute --network development --path scripts/deployment/14_collateral-token-adapter/initialize/initialize_collateral-token-adapter-USDT-COL.js

# whiteList collateral token-adapter-USDT, FTHM, USDT-COL
	# coralX execute --network development --path scripts/deployment/2_book-keeper/config/whitelist-collateral-token-adapter-USDT.js
	# coralX execute --network development --path scripts/deployment/2_book-keeper/config/whitelist-collateral-token-adapter-USDT-COL.js
	# coralX execute --network development --path scripts/deployment/2_book-keeper/config/whitelist-collateral-token-adapter-FTHM.js


# grant adapter role to collateralTokenAdapterUSDT/USDT-COL/FTHM
	# coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role-USDT.js
	# coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role-USDT-COL.js

	# coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role-FTHM.js

# collateral-pool-config-USDT, USDT-COL, FTHM
	# coralX execute --network development --path scripts/deployment/1_collateral-pool-config/config/collateral-pool-config-USDT.js

	# coralX execute --network development --path scripts/deployment/1_collateral-pool-config/config/collateral-pool-config-USDT-COL.js
	# coralX execute --network development --path scripts/deployment/1_collateral-pool-config/config/collateral-pool-config-FTHM.js

#Grant stablecoin's ownership to fairLaunch
	# coralX execute --network development --path scripts/deployment/9_fathom-token/config/fathom-token-ownership.js

# Adding priceOracle address to liquidation-engine's storage
	coralX execute --network development --path scripts/deployment/5_liquidation-engine/config/config_liquidation-engine.js
# Adding priceOracle address to Position Manager's storage
	coralX execute --network development --path scripts/deployment/13_position-manager/config/config_position-manager.js
# mint more tokens
	# coralX execute --network development --path scripts/deployment/11_WXDC/initialize/initialize_WXDC.js
	# coralX execute --network development --path scripts/deployment/22_USDT-mock/initialize/initialize_USDT.js

# DEX Integration Scripts

# better check if scripts above work, then move on to DEX Integration Scripts

# fathomStats can be deployed after DEXPriceOracle is set.
proxy:
	coralX execute --network gorli --path scripts/deployment/a_proxy/accessControlConfig.js

gorliPM:
	coralX execute --network gorli --path scripts/deployment/25_get-positions/deploy/get-positions.js
gorliPMInit:
		coralX execute --network gorli --path scripts/deployment/25_get-positions/initialize/initialize_get-positionsGorli.js

fathomStats:
	coralX execute --network development --path scripts/deployment/27_stats/deploy/stats.js
	coralX execute --network development --path scripts/deployment/27_stats/initialize/initialize_stats.js
getPositionsV2:
	coralX execute --network development --path scripts/deployment/28_get-positions-v2/deploy/get-positions-v2.js

	coralX execute --network development --path scripts/deployment/28_get-positions-v2/initialize/initialize_get-positions-v2.js

callsetPriceFTHM:
	coralX execute --network development --path scripts/deployment/15_simple-price-feed/config/config_simple-price-feed-FTHM.js
	coralX execute --network development --path scripts/deployment/15_simple-price-feed/config/config_simple-price-feed-WXDC.js

	# coralX execute --network development --path scripts/deployment/7_price-oracle/config/setPriceFTHM.js

checkProxyWallet:

	coralX execute --network development --path scripts/tests/0_makeWallet/2_makeWallet.js

bot:
	# give minter role to liquidation bot 0xe7B11F39E08089B1d76A79D6272AC7Ad11E8eFe9
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/grant-mintable-role-liquidation-bot.js
bot2:
# deploy getPositionsBot for liquidation bot
	coralX execute --network development --path scripts/deployment/29_get-positions-bot/deploy/get-positions-bot.js
bot3:
	coralX execute --network development --path scripts/deployment/29_get-positions-bot/initialize/initialize_get-positions-bot.js
mintMore:
	# mint more tokens
	coralX execute --network development --path scripts/deployment/11_WXDC/initialize/initialize_WXDC.js
	coralX execute --network development --path scripts/deployment/22_USDT-mock/initialize/initialize_USDT.js
dexIntegration:
	#deploy DexPriceOracle
	coralX execute --network development --path scripts/deployment/21_dex-price-oracle/deploy/dex-price-oracle.js
	coralX execute --network development --path scripts/deployment/21_dex-price-oracle/initialize/initialize_dex-price-oracle.js

	#deploy FathomOraclePriceFeed
	#for WXDC
	coralX execute --network development --path scripts/deployment/26_fathom-oracle-price-feed/deploy/fathom-oracle-price-feedWXDC.js
	coralX execute --network development --path scripts/deployment/26_fathom-oracle-price-feed/initialize/initialize_fathom-oracle-price-feedWXDC.js

	#for FTHM
	# coralX execute --network development --path scripts/deployment/26_fathom-oracle-price-feed/deploy/fathom-oracle-price-feedFTHM.js
	# coralX execute --network development --path scripts/deployment/26_fathom-oracle-price-feed/initialize/initialize_fathom-oracle-price-feedFTHM.js

	#setPriceFeed to FathomOraclePriceFeed
	#for WXDC only
	coralX execute --network development --path scripts/deployment/1_collateral-pool-config/config/setPriceFeed.js

	# //change LTV
	coralX execute --network development --path scripts/deployment/1_collateral-pool-config/config/ltv.js

	# //SetPrice for WXDC and FTHM
	coralX execute --network development --path scripts/deployment/7_price-oracle/config/setPrice.js
	# coralX execute --network development --path scripts/deployment/7_price-oracle/config/setPriceFTHM.js

tankUSDT:
#for some reason, USDT-STABLE is used to open position.
#and unfortunately, USDT-COL does not really work and it fails.
#better be tested locally
	# for quick price manipulation, running scripts below will make your life easier.
	# First set price to change prce in simplePriceFeed
	coralX execute --network development --path scripts/deployment/15_simple-price-feed/config/config_simple-price-feed-USDT.js
	# Second set price to update priceWithSafetyMargin in PriceOracle for USDT
	coralX execute --network development --path scripts/deployment/7_price-oracle/config/setPriceUSDT.js
tankWXDC:
#for some reason, USDT-STABLE is used to open position.
#and unfortunately, USDT-COL does not really work and it fails.
#better be tested locally
	# for quick price manipulation, running scripts below will make your life easier.
	# First set price to change prce in simplePriceFeed
	coralX execute --network development --path scripts/deployment/15_simple-price-feed/config/config_simple-price-feed-WXDC.js
	# Second set price to update priceWithSafetyMargin in PriceOracle for WXDC
	coralX execute --network development --path scripts/deployment/7_price-oracle/config/setPrice.js

tankXDC:
#for some reason, USDT-STABLE is used to open position.
#and unfortunately, USDT-COL does not really work and it fails.
#better be tested locally
	# for quick price manipulation, running scripts below will make your life easier.
	# First set price to change prce in simplePriceFeed
	coralX execute --network development --path scripts/deployment/15_simple-price-feed/config/config_simple-price-feed-WXDC.js
	# Second set price to update priceWithSafetyMargin in PriceOracle for WXDC
	coralX execute --network development --path scripts/deployment/7_price-oracle/config/setPriceXDC.js


tankFTHM:
#for some reason, USDT-STABLE is used to open position.
#and unfortunately, USDT-COL does not really work and it fails.
#better be tested locally
	# for quick price manipulation, running scripts below will make your life easier.
	# First set price to change prce in simplePriceFeed
	coralX execute --network development --path scripts/deployment/15_simple-price-feed/config/config_simple-price-feed-FTHM.js
	# Second set price to update priceWithSafetyMargin in PriceOracle for FTHM
	coralX execute --network development --path scripts/deployment/7_price-oracle/config/setPriceFTHM.js


check:
	coralX execute --network development --path scripts/PrepSepDemo/openClosePosition/3_openPosition.js
stableSwap to generate FXD for providing liquidity:
	# needs to be adjusted in coralX syntax
	coralX execute --network development --path scripts/PrepSepDemo/stableSwap/1_mintUSDTtoDeployer.js
	coralX execute --network development --path scripts/PrepSepDemo/stableSwap/2_swapThreeMilUSDT.js
mockPoolInfo:
	coralX execute --network development --path scripts/deployment/27_stats/deploy/mockPoolInfo.js
mintable-role-bot:
	coralX execute --network development --path scripts/deployment/0_access-control-config/config/archive_apothem/grant-mintable-role-liquidation-bot.js
whiteListBot:
	# I would have to whitelist bot to liq. engine
	coralX execute --network development --path scripts/deployment/5_liquidation-engine/config/config_liquidation-engine-whiteListBot.js

makeWallet:
	coralX execute --network development --path scripts/ankrIntTest/positionOpening.js
closePositionFull:
	coralX execute --network development --path scripts/ankrIntTest/closePositionFull.js

partialClosePosition:
	coralX execute --network development --path scripts/ankrIntTest/closePositionPartial.js


