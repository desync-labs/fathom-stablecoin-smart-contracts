# Fathom Stablecoin Smart Contracts

## Short instruction

The best condition to run this project is as below.

node -v
v16.14.2

ganache-cli --version
Ganache CLI v6.12.2 (ganache-core: 2.13.2)

To run the scripts in this project.

Please install dependencies with command below.

    npm i

Then please run ganache with command below.

    ganache-cli -m YOUR_MNEMONIC --gasLimit 12000000

To compile please run command below.

    npx hardhat compile

To run scripts in this project, please run scripts with command below.

    npx hardhat run --network ganache scripts/scenarioName/jsFile.js

For example, if you would like to run scripts in scenario a_liquidationScenario, start with

    npx hardhat run --network ganache scripts/a_liquidationScenario/0_deployment.js
    ... ... ...
    npx hardhat run --network ganache scripts/a_liquidationScenario/4_liquidation.js

Each scripts console.logs information about each step in a scenario.


## Background information about the smart contract

Current codebase is a simplified version of Alpaca stablecoin. Two deleted features are

1) Upgradeable Openzeppelin library
2) Openzeppelin Access control

Upgradeability is taken out since Fathom stablecoin would be imported to DAC and DAC has better upgrade system

Access control was also taken out for the same reason.

## What is a Position
Position in CDP based stablecoin consists of three elements. PositionId, lockedCollateral and debtshare. PositionId is a counter that keeps increasing whenever a position gets opened. LockedCollateral is alias for collateralized asset amount. Debtshare shows how much stablecoin was borrowed for a position. When a position is closed or liquidated positionId remains on chain, however, debtshare that is attached to the positionID becomes 0.

## What is proxyWallet
Proxywallet is a entrypoint to protocol for users.

## What is positionAddress
Position address is a unique address given to each position. Whenever a new position opens, positionHandler smart contract gets created and its address is used as positionAddress.


## Internal and external stablecoin balance

Stablecoin puts unique name tags to money.

Internal stablecoin balance is
   
      mapping(address => uint256) stablecoin

in bookKeeper.sol

StablecoinAdapter's balance in stablecoin indicates how many stablecoins were actually minted as ERC20.

An easy way to understand this is

The money that central bank made within their server and its existence shared among bank is like stablecoin's internal stablecoin balance in bookKeeper.sol

Cash that central bank printed and circulated in the market is like external stablecoin balance(Minted ERC20 stablecoin)

systemDebtEngine's internal stablecoin balance is stablecoinSurplus and it is stablecoin balance for the protocol.

## CollateralSurplus, stablecoinSurplus, systemDebt

### Collateral Surplus

Collateral surplus is generated when a position is liquidated. Protocol takes a portion of liquidated collateral and name it as collateralSurplus.

CollateralTokenAdapter.sol's staked amount for systemDebtEngine is collateralSurplus.

### Stablecoin Surplus

Stablecoin surplus is generated under three conditions.

1)When stabilityFee is collected.

2)When usr uses stableSwapModule. Fees for using stablecoinSwapModule is calculated as stablecoin and systemDebtEngine's internal stablecoin balance is increased accordingly.

3)When the manager of the protocol attempts to directly increase internal balance of systemDebtEngine w/o collateral asset.

### System Debt

systemDebt is generated when a position is liquidated but the liquidated collateral's value is not enough to cover the position's debtValue.

### Settlement of system debt

In order for protocol manager to withdraw stablecoin surplus, systemDebt amount must be 0. SystemDebt amount can be settled with stablecoinSurplus.

### Withdrawal of Stablecoin surplus

Stablecoin surplus can be withdrawn after systemDebt is settled(systemDebt === 0) and stablecoinSurplus exceed the safetyBuffer amount of stablecoin. The protocol encourages protocol manager to hold a certain amount of buffer balance for the rainy days.

## 16 scenarios and more to come

Contrary to Alpaca's test scripts, that test smart contracts within simplified environment, Fathom stablecoin team strived to test the codebase with realistic scenarios. Scenarios cover; Position manipulation, liquidation, system surplus/debt management, pegging mechanism testing, DEX as price feed. 16 Scenarios cover core functionalities of CDP based smart contract, however, due to stablecoin's complexity there are more topics of research available.

## Scenarios in detail

### a_liquidationScenario

Opening a position is the most important functionality of CDP based stablecoin. In this scenario Alice opens a position when WXDC's _priceWithSafetyMargin is $2. She collateralize 1 WXDC and borrows 1 FathomStablecoin. Then _priceWithSafetyMargin drops to $0.25. Position becomes risky and Bob liquidates it. As Bob liquidates Alice's collateral, he receives collateral asset as staked in CollateralTokenAdapter.
Perhaps it is important to emphasize that current stablecoin protocol requires a proxyWallet for a user to participate in the protocol. ProxyWallet is simply a smart contract which acts as an entry point for users to interact with stablecoin protocol. Functions in ProxyActions.sol are called to proxyWallet and then the function is delegate called to ProxyActions which in series makes calls to smart contracts within the protocol. 
In this scenario, Bob does not hold actual balance of stablecoin in this scenario but holds internal balance of stablecoin within the protocol. In o_depositStablecoin scenario, Alice deposit ERC20 stablecoin into the system to top up Bob's internal stablecoin balance.

### b_positionClosureScenario

In this scenario, Alice opens a position and closes her position by returning FathomStablecoin that she borrowed.

### c_positionMoveScenario

Owner of a position can move the position's collateral value or debt value from a position to another. 

### d_adjustPosition

Position Manipulation script.

### e_stableSwapScenario

Please refer to readme.md file in the folder. This scenario involves deployment of DEX. This hardhat project does not include DEX smart contract.

### f_stabilityFeeManipulation

Stability fee is stablecoin way of calling borrowing interest rate. Anyone can call collet function which increases stablecoinSurplus amount. StablecoinSurplus amount is internal stablecoin balance of systemDebtEngine.

Each collateral class has its own stability fee since each collateral asset class has different price volatility. 

Stablecoin's stability fee can be configured individually by collateral asset class. In this scenario, collect function in stabilityFee module is called and _debtAccumulate rate is increased.

_debtAccumulated rate is a way of representing interest rate in stablecoin. When the parameter is 1 RAY (10**27), it means there is no interest rate for users to pay. However, after systemDebtEngine's internal balance increases, _debtAccumulated rate increases. _debtAccumulated rate affects _safetyBuffer which is an indicator of positions' health.

### g_globalStabilityFeeManipulation

GlobalStabilityFee is interest rate that all collateral asset classes share. 

    stabilityFee = globalStabilityFee + assetSpecificFee
    
However, when we tested the codebase, only globalStabilityFee by its own worked and assetSpecificFee by it self worked. When we tried to set globalStabilityFee and assetSpecificFee together, code threw error. It is not a big issue for running a protocol since cofiguring assetSpecific stability fee is enough to run the business.

### h_withdrawCollateralSurplus

This scenario withdraws collateral surplus from CollateralTokenAdapter's staked balance

### i_SettleSystemDebt

This scenario settles systemBadDebt with stablecoinSurplus. It is good to follow internal balance of systemDebtEngine.

### j_withdrawStablecoinSurplus

This scenario withdraws stablecoin surplus. It is also good to follow internal balance of systemDebtEngine.

### k_withdrawCollateral

This scenario withdraws collateral.

### l_withdrawStablecoin

This scenario withdraws stablecoin.

### m_depositColateral

This scenario deposits collateral to a position.

### o_depositStablecoin

In this scenario, Alice opens a position to deposit ERC20 stablecoin internally for Bob so he can liquidate Alice's position. It is very similar to the first scenario, however, the difference is that liquidator has internal stablecoin balance from stablecoin deposit not unbacked minting.

### y_uniswapPriceFeed

To run this scenario, DEX project is needed.
1)Deploy two tokens
2)Move token addresses to DEX Project.
3)Deploy DEX and make a pair.
4)Deploy stablecoin smart contracts
5)Call DexPriceOracle's getPrices function to check the price coming from DEX.

### z_liquidationBot

This scenario heavily depends on liquidation bot. Please refer to author of liquidation bot.


## safetyBufferCalculation model

https://docs.google.com/spreadsheets/d/1gt3fg1WqaovCTyPjba8vxHVzCGBW8V3bO3M2xNpyo0A/edit?usp=sharing

### Purpose of creating this model

Stablecoin team created a safetyBuffercalculation model to 

    1) fully comprehend CDP based stablecoin protocol
    2) conduct Stochastic experiments in the future

With safetyBufferCalculation model, it is possible to calculate health of positions.

## liquidation formula

Alpaca's Fixed spread liquidation can be summarized to a simple formula below.

![](https://i.imgur.com/YXzhzKQ.png)

Once debtValue that needs to be liquidated is set, it is possible to know how many collateral token needs to be liquidated.

If liquidator is given more incentives, more amount of collateral token needs to be liquidated.

If price of collateral drops, more collateral token needs to be liquidated.



## Future topics of research

1)Restriction on maximum lending.

safetyBuffer, when stablecoin is borrowed to maximum amount, is exactly calculated as 0. Our current liquidation bot tries to liquidate a position when safetyBuffer is zero and it tries to liquidate a position that is still healthy but debtValue is at its maimum. One way to solve this issue is to make 

    borrowable stablecoin amount < MaxLTV * collateralValue
    
    when
    collateralValue = lockedCollateral * _priceWithSafetyMargin

Two topics of research is

    1. Chicken or egg question. Is it a right approach to fix stablecoin codebase for liquidation bot?

    2. How would change above affect stablecoin internals Code may work, but would math all be smooth?

2)_debtAccumulatedRate calculation model

It is clear that collect function of stabilityFee module increases _debtAccumulatedRate. And _debtAccumulatedRate above 1 RAY affects _safetyBuffer of a position. Further research should cover exact calculation formula for _debtAccumulatedRate and integration to safetyBufferCalculation model.

3)liquidation model

Fixed spread liquidation model is indeed a good approach. Future research on flexible close factor is needed.