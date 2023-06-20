#### Issue Old price becomes valid in `DelayPriceFeedBase`
##### Description
In the function execute in the FixedSpreadLiquidationStrategy contract, the user can prevent his position from being liquidated.
This can happen according to the following scenario:
The functions `adjustPosition`, `moveCollateral`, `redeemLockedCollateral` in the PositionManager contract the protocol accept an _adapter parameter. Malicious actor may supply a wrong adapter, which will cause a balance mismatch in the BookKeeper and CollateralTokenAdapter, which can be used to attack the protocol.

##### Fix
`_adapter` parameter was removed from functions: `adjustPosition`, `moveCollateral`, `redeemLockedCollateral` in PositionManager.

##### Updagrading contracts
1. 1. update `upgrade-contracts.js` script with actual addresses
2. run `coralx execute --network {network} --path scripts/upgrades/0_062023/1_static-adapter/upgrade-contracts.js`