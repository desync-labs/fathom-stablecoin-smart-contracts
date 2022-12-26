bot:
	# give minter role to liquidation bot 0xe7B11F39E08089B1d76A79D6272AC7Ad11E8eFe9
	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-mintable-role-liquidation-bot.js
bot2:
# deploy getPositionsBot for liquidation bot
	coralX execute --network apothem --path scripts/deployment/29_get-positions-bot/deploy/get-positions-bot.js
bot3:
	coralX execute --network apothem --path scripts/deployment/29_get-positions-bot/initialize/initialize_get-positions-bot.js
dexInt99:
	# mint more tokens
	coralX execute --network apothem --path scripts/deployment/11_WXDC/initialize/initialize_WXDC.js
	coralX execute --network apothem --path scripts/deployment/22_USDT-mock/initialize/initialize_USDT.js
dexInt0:
	#deploy DexPriceOracle
	# coralX execute --network apothem --path scripts/deployment/21_dex-price-oracle/deploy/dex-price-oracle.js
	coralX execute --network apothem --path scripts/deployment/21_dex-price-oracle/initialize/initialize_dex-price-oracle.js
dexInt1:
	#deploy FathomOraclePriceFee
	# coralX execute --network apothem --path scripts/deployment/26_fathom-oracle-price-feed/deploy/fathom-oracle-price-feed.js
	coralX execute --network apothem --path scripts/deployment/26_fathom-oracle-price-feed/initialize/initialize_fathom-oracle-price-feed.js
dexInt2:
	#setPriceFeed to FathomOraclePriceFeed
	coralX execute --network apothem --path scripts/deployment/1_collateral-pool-config/config/setPriceFeed.js

dexInt3:
	# //change LTV --done -I need to do this for Gorli as well
	coralX execute --network apothem --path scripts/deployment/1_collateral-pool-config/config/ltv.js

dexInt4:
	# //SetPrice --done - Ineed to do this or Gorli as well.
	coralX execute --network apothem --path scripts/deployment/7_price-oracle/config/setPrice.js

tankUSDT:
	# First set price in simplePriceFeed
	coralX execute --network apothem --path scripts/deployment/15_simple-price-feed/config/config_simple-price-feed-USDT.js
	# Second set price in PriceOracle for USDT
	coralX execute --network apothem --path scripts/deployment/7_price-oracle/config/setPriceUSDT.js

fathomStats:
	# coralX execute --network apothem --path scripts/deployment/27_stats/deploy/stats.js
	coralX execute --network apothem --path scripts/deployment/27_stats/initialize/initialize_stats.js
check:
	coralX execute --network apothem --path scripts/PrepSepDemo/openClosePosition/3_openPosition.js
deploy:
	coralX execute --network apothem --path scripts/deployment/0_access-control-config/deploy/deploy_accessControlConfig.js
	coralX execute --network apothem --path scripts/deployment/0_access-control-config/initialize/initialize_accessControlConfig.js

	coralX execute --network apothem --path scripts/deployment/1_collateral-pool-config/deploy/collateral-pool-config.js
	# coralX execute --network apothem --path scripts/deployment/1_collateral-pool-config/deploy/collateral-pool-config-USDT.js

# deploy1:
	coralX execute --network apothem --path scripts/deployment/1_collateral-pool-config/initialize/initialize_collateralPoolConfig.js
	# coralX execute --network apothem --path scripts/deployment/1_collateral-pool-config/initialize/initialize_collateralPoolConfig-USDT.js

# deploy2:
	coralX execute --network apothem --path scripts/deployment/2_book-keeper/deploy/book-keeper.js
	coralX execute --network apothem --path scripts/deployment/2_book-keeper/initialize/initialize_book-keeper.js
	coralX execute --network apothem --path scripts/deployment/3_fathom-stablecoin/deploy/fathom-stablecoin.js
	coralX execute --network apothem --path scripts/deployment/3_fathom-stablecoin/initialize/initialize_fathom-stablecoin.js
	coralX execute --network apothem --path scripts/deployment/4_system-debt-engine/deploy/system-debt-engine.js
	coralX execute --network apothem --path scripts/deployment/4_system-debt-engine/initialize/initialize_system-debt-engine.js
# deploy3:
	coralX execute --network apothem --path scripts/deployment/5_liquidation-engine/deploy/liquidation-engine.js
	coralX execute --network apothem --path scripts/deployment/5_liquidation-engine/initialize/initialize_liquidation-engine.js
# deploy4:
	coralX execute --network apothem --path scripts/deployment/6_stablecoin-adapter/deploy/stablecoin-adapter.js
	coralX execute --network apothem --path scripts/deployment/6_stablecoin-adapter/initialize/initialize_stablecoin-adapter.js
# deploy5:
	coralX execute --network apothem --path scripts/deployment/7_price-oracle/deploy/price-oracle.js
	coralX execute --network apothem --path scripts/deployment/7_price-oracle/initialize/initialize_price-oracle.js
# deploy6:
	coralX execute --network apothem --path scripts/deployment/8_show-stopper/deploy/show-stopper.js
	coralX execute --network apothem --path scripts/deployment/8_show-stopper/initialize/initialize_show-stopper.js
deploy7:
	coralX execute --network apothem --path scripts/deployment/9_fathom-token/deploy/fathom-token.js
	coralX execute --network apothem --path scripts/deployment/10_fair-launch/deploy/fair-launch.js
# deploy8:
	coralX execute --network apothem --path scripts/deployment/11_WXDC/deploy/WXDC.js
	coralX execute --network apothem --path scripts/deployment/11_WXDC/initialize/initialize_WXDC.js
# deploy9:
	coralX execute --network apothem --path scripts/deployment/22_USDT-mock/deploy/USDT.js
	coralX execute --network apothem --path scripts/deployment/22_USDT-mock/initialize/initialize_USDT.js
# deploy10:
	coralX execute --network apothem --path scripts/deployment/12_shield/deploy/shield.js
	coralX execute --network apothem --path scripts/deployment/10_fair-launch/config/fair-launch-config.js

	coralX execute --network apothem --path scripts/deployment/13_position-manager/deploy/position-manager.js
	coralX execute --network apothem --path scripts/deployment/13_position-manager/initialize/initialize_position-manager.js
# deploy11:
	coralX execute --network apothem --path scripts/deployment/14_collateral-token-adapter/deploy/collateral-token-adapter.js
	coralX execute --network apothem --path scripts/deployment/14_collateral-token-adapter/initialize/initialize_collateral-token-adapter.js

	coralX execute --network apothem --path scripts/deployment/15_simple-price-feed/deploy/simple-price-feed.js
	coralX execute --network apothem --path scripts/deployment/15_simple-price-feed/deploy/simple-price-feed-USDT.js

	coralX execute --network apothem --path scripts/deployment/15_simple-price-feed/deploy/simple-price-feed-USDT-COL.js

	coralX execute --network apothem --path scripts/deployment/15_simple-price-feed/deploy/simple-price-feed-FTHM.js
# deploy12:
	coralX execute --network apothem --path scripts/deployment/15_simple-price-feed/initialize/initialize_simple-price-feed.js
	coralX execute --network apothem --path scripts/deployment/15_simple-price-feed/initialize/initialize_simple-price-feed-USDT.js

	coralX execute --network apothem --path scripts/deployment/15_simple-price-feed/initialize/initialize_simple-price-feed-USDT-COL.js
	coralX execute --network apothem --path scripts/deployment/15_simple-price-feed/initialize/initialize_simple-price-feed-FTHM.js


	coralX execute --network apothem --path scripts/deployment/16_fixed-spread-liquidation-strategy/deploy/fixed-spread-liquidation-strategy.js
	coralX execute --network apothem --path scripts/deployment/16_fixed-spread-liquidation-strategy/initialize/initialize_fixed-spread-liquidation-strategy.js
# deploy13:
	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-price-oracle-role.js
	coralX execute --network apothem --path scripts/deployment/1_collateral-pool-config/config/collateral-pool-config.js
# deploy14:
	coralX execute --network apothem --path scripts/deployment/17_proxy-actions/deploy/proxy-actions.js
# deploy15:
	coralX execute --network apothem --path scripts/deployment/18_stability-fee-collector/deploy/stability-fee-collector.js
	coralX execute --network apothem --path scripts/deployment/18_stability-fee-collector/initialize/initialize_stability-fee-collector.js

	coralX execute --network apothem --path scripts/deployment/19_proxy-wallet-factory/deploy/proxy-wallet-factory.js
# deploy16:
	coralX execute --network apothem --path scripts/deployment/20_proxy-wallet-registry/deploy/proxy-wallet-registry.js
	coralX execute --network apothem --path scripts/deployment/20_proxy-wallet-registry/initialize/initialize_proxy-wallet-registry.js
# deploy17:
	# coralX execute --network apothem --path scripts/deployment/21_dex-price-oracle/deploy/dex-price-oracle.js
	# coralX execute --network apothem --path scripts/deployment/21_dex-price-oracle/initialize/initialize_dex-price-oracle.js
# deploy18:
	coralX execute --network apothem --path scripts/deployment/23_auth-token-adapter/deploy/auth-token-adapter.js
	coralX execute --network apothem --path scripts/deployment/23_auth-token-adapter/initialize/initialize_auth-token-adapter.js
# deploy19:
	coralX execute --network apothem --path scripts/deployment/24_stable-swap-module/deploy/stable-swap-module.js
	coralX execute --network apothem --path scripts/deployment/24_stable-swap-module/initialize/initialize_stable-swap-module.js
# deploy20:
	coralX execute --network apothem --path scripts/deployment/25_get-positions/deploy/get-positions.js
	coralX execute --network apothem --path scripts/deployment/25_get-positions/initialize/initialize_get-positions.js

	coralX execute --network apothem --path scripts/deployment/23_auth-token-adapter/config/auth-token-adapter-whitelist.js
	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role.js

	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-auth-token-adapter-role.js

	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-book-keeper-role.js

	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-collateral-manager-role.js

	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-gov-role.js

	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-liquidation-engine-role.js

	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-liquidation-strategy-role.js

	# coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-mintable-role.js

	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-position-manager-role.js

	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-show-stopper-role.js

	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-stability-fee-collector-role.js

	coralX execute --network apothem --path scripts/deployment/3_fathom-stablecoin/config/grant-minter-role.js

	coralX execute --network apothem --path scripts/deployment/2_book-keeper/config/set-total-debt-ceiling.js

	coralX execute --network apothem --path scripts/deployment/24_stable-swap-module/config/set-fee-in.js
	
	coralX execute --network apothem --path scripts/deployment/24_stable-swap-module/config/set-fee-out.js

	coralX execute --network apothem --path scripts/deployment/2_book-keeper/config/whitelist-collateral-token-adapter.js

	# coralX execute --network apothem --path scripts/deployment/10_fair-launch/config/fair-launch-config-USDT.js

	# deploy for USDT-STABLE, FTHM, USDT-COL
	coralX execute --network apothem --path scripts/deployment/14_collateral-token-adapter/deploy/collateral-token-adapter-USDT.js
	coralX execute --network apothem --path scripts/deployment/14_collateral-token-adapter/initialize/initialize_collateral-token-adapter-USDT.js
# deploy21:
	coralX execute --network apothem --path scripts/deployment/14_collateral-token-adapter/deploy/collateral-token-adapter-FTHM.js
	coralX execute --network apothem --path scripts/deployment/14_collateral-token-adapter/initialize/initialize_collateral-token-adapter-FTHM.js

	coralX execute --network apothem --path scripts/deployment/14_collateral-token-adapter/deploy/collateral-token-adapter-USDT-COL.js
	coralX execute --network apothem --path scripts/deployment/14_collateral-token-adapter/initialize/initialize_collateral-token-adapter-USDT-COL.js

	#WHITELISTING for collateral-token-adapter-USDT, FTHM, USDT-COL
	coralX execute --network apothem --path scripts/deployment/2_book-keeper/config/whitelist-collateral-token-adapter-USDT.js
	coralX execute --network apothem --path scripts/deployment/2_book-keeper/config/whitelist-collateral-token-adapter-USDT-COL.js

	coralX execute --network apothem --path scripts/deployment/2_book-keeper/config/whitelist-collateral-token-adapter-FTHM.js


	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role.js

	# collateral-pool-config-USDT, USDT-COL, FTHM
	coralX execute --network apothem --path scripts/deployment/1_collateral-pool-config/config/collateral-pool-config-USDT.js

	coralX execute --network apothem --path scripts/deployment/1_collateral-pool-config/config/collateral-pool-config-USDT-COL.js

	coralX execute --network apothem --path scripts/deployment/1_collateral-pool-config/config/collateral-pool-config-FTHM.js

	#Granting collateral-token-adapter-USDT, FTHM, USDT-COL
	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role-USDT.js

	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role-USDT-COL.js

	coralX execute --network apothem --path scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role-FTHM.js


	coralX execute --network apothem --path scripts/deployment/9_fathom-token/config/fathom-token-ownership.js

	# Adding priceOracle address to liquidation-engine's storage
	coralX execute --network apothem --path scripts/deployment/5_liquidation-engine/config/config_liquidation-engine.js
	# Adding priceOracle address to Position Manager's storage
	coralX execute --network apothem --path scripts/deployment/13_position-manager/config/config_position-manager.js

	# mint more tokens
	coralX execute --network apothem --path scripts/deployment/11_WXDC/initialize/initialize_WXDC.js
	coralX execute --network apothem --path scripts/deployment/22_USDT-mock/initialize/initialize_USDT.js

break:
next:

	coralX execute --network apothem --path scripts/PrepSepDemo/openClosePosition/2_makeWallet.js
	coralX execute --network apothem --path scripts/PrepSepDemo/openClosePosition/3_openPosition.js
	coralX execute --network apothem --path scripts/PrepSepDemo/openClosePosition/4_closePosition.js
	coralX execute --network apothem --path scripts/PrepSepDemo/openClosePosition/5_liquidation.js

	coralX execute --network apothem --path scripts/PrepSepDemo/stableSwap/1_mintUSDTtoDeployer.js
	coralX execute --network apothem --path scripts/PrepSepDemo/stableSwap/2_swapThreeMilUSDT.js

note:
	# I might have to set price again, just like what happend with Goerli