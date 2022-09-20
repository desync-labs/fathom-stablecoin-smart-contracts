# make deploy  <- deploy stablecoin having simplePriceFeed.

deploy:
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/deploy/deploy_accessControlConfig.js
	npx hardhat run --network ganache scripts/deployment/1_collateral-pool-config/deploy/collateral-pool-config.js
	npx hardhat run --network ganache scripts/deployment/1_collateral-pool-config/deploy/collateral-pool-config-USDT.js
	npx hardhat run --network ganache scripts/deployment/2_book-keeper/deploy/book-keeper.js
	npx hardhat run --network ganache scripts/deployment/3_fathom-stablecoin/deploy/fathom-stablecoin.js
	npx hardhat run --network ganache scripts/deployment/4_system-debt-engine/deploy/system-debt-engine.js
	npx hardhat run --network ganache scripts/deployment/5_liquidation-engine/deploy/liquidation-engine.js
	npx hardhat run --network ganache scripts/deployment/6_stablecoin-adapter/deploy/stablecoin-adapter.js
	npx hardhat run --network ganache scripts/deployment/7_price-oracle/deploy/price-oracle.js
	npx hardhat run --network ganache scripts/deployment/8_show-stopper/deploy/show-stopper.js
	npx hardhat run --network ganache scripts/deployment/9_fathom-token/deploy/fathom-token.js
	npx hardhat run --network ganache scripts/deployment/10_fair-launch/deploy/fair-launch.js
	npx hardhat run --network ganache scripts/deployment/11_WXDC/deploy/WXDC.js
	npx hardhat run --network ganache scripts/deployment/22_USDT-mock/deploy/USDT.js
	npx hardhat run --network ganache scripts/deployment/12_shield/deploy/shield.js
	npx hardhat run --network ganache scripts/deployment/10_fair-launch/config/fair-launch-config.js
	npx hardhat run --network ganache scripts/deployment/13_position-manager/deploy/position-manager.js
	npx hardhat run --network ganache scripts/deployment/14_collateral-token-adapter/deploy/collateral-token-adapter.js
	npx hardhat run --network ganache scripts/deployment/15_simple-price-feed/deploy/simple-price-feed.js
	npx hardhat run --network ganache scripts/deployment/15_simple-price-feed/deploy/simple-price-feed-USDT.js
	npx hardhat run --network ganache scripts/deployment/16_fixed-spread-liquidation-strategy/deploy/fixed-spread-liquidation-strategy.js
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-price-oracle-role.js
	npx hardhat run --network ganache scripts/deployment/1_collateral-pool-config/config/collateral-pool-config.js
	npx hardhat run --network ganache scripts/deployment/17_proxy-actions/deploy/proxy-actions.js
	npx hardhat run --network ganache scripts/deployment/18_stability-fee-collector/deploy/stability-fee-collector.js
	npx hardhat run --network ganache scripts/deployment/19_proxy-wallet-factory/deploy/proxy-wallet-factory.js
	npx hardhat run --network ganache scripts/deployment/20_proxy-wallet-registry/deploy/proxy-wallet-registry.js
	npx hardhat run --network ganache scripts/deployment/21_dex-price-oracle/deploy/dex-price-oracle.js

	npx hardhat run --network ganache scripts/deployment/23_auth-token-adapter/deploy/auth-token-adapter.js
	npx hardhat run --network ganache scripts/deployment/24_stable-swap-module/deploy/stable-swap-module.js
	npx hardhat run --network ganache scripts/deployment/25_get-positions/deploy/get-positions.js
	npx hardhat run --network ganache scripts/deployment/23_auth-token-adapter/config/auth-token-adapter-whitelist.js
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role.js
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-auth-token-adapter-role.js
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-book-keeper-role.js
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-collateral-manager-role.js
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-gov-role.js
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-liquidation-engine-role.js
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-liquidation-strategy-role.js
	# npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-mintable-role.js
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-position-manager-role.js
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-show-stopper-role.js
	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-stability-fee-collector-role.js
	npx hardhat run --network ganache scripts/deployment/3_fathom-stablecoin/config/grant-minter-role.js
	npx hardhat run --network ganache scripts/deployment/2_book-keeper/config/set-total-debt-ceiling.js
	npx hardhat run --network ganache scripts/deployment/24_stable-swap-module/config/set-fee-in.js
	npx hardhat run --network ganache scripts/deployment/24_stable-swap-module/config/set-fee-out.js
	npx hardhat run --network ganache scripts/deployment/2_book-keeper/config/whitelist-collateral-token-adapter.js

		# npx hardhat run --network ganache scripts/deployment/10_fair-launch/config/fair-launch-config-USDT.js

	npx hardhat run --network ganache scripts/deployment/14_collateral-token-adapter/deploy/collateral-token-adapter-USDT.js
	npx hardhat run --network ganache scripts/deployment/2_book-keeper/config/whitelist-collateral-token-adapter-USDT.js

	npx hardhat run --network ganache scripts/deployment/0_access-control-config/config/grant-collateral-token-adapter-role.js
	npx hardhat run --network ganache scripts/deployment/1_collateral-pool-config/config/collateral-pool-config-USDT.js

	npx hardhat run --network ganache scripts/deployment/9_fathom-token/config/fathom-token-ownership.js

zero:
	npx hardhat run --network ganache scripts/scenarios/a_liquidationScenario/0_deployment.js









	