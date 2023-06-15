#### Issue Old price becomes valid in `DelayPriceFeedBase`
##### Description
In the function [`setPriceLife`](https://github.com/Into-the-Fathom/fathom-stablecoin-smart-contracts/tree/6c710b47e07f70c38207c50270f81e1d69c874c8/contracts/main/price-feeders/DelayPriceFeedBase.sol#L41) in the `DelayPriceFeedBase` contract, the price is not updated in `setPriceLife` call. If the current price was not up to date and with the peekPrice call the _isPriceOk function returns `true` with the change of `setPriceLife` to bigger value, the previous price can become relevant. It may lead to price manipulations and massive liquidations on volatile market, generating bad debt.

##### Fix
`peekPrice` function call was added to the `setPriceLife` function in the `DelayPriceFeedBase` contract.

##### Updagrading contracts
1. update `upgrade-contracts.js` script with actual addresses.
2. run `coralx execute --network {network} --path scripts/upgrades/0_062023/0_setPriceLife-fix/upgrade-contracts.js`