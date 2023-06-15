#### Issue Several important variables are not zeroed in `emergencyWithdraw` in `StableSwapModule`
##### Description
In the function [`emergencyWithdraw`](https://github.com/Into-the-Fathom/fathom-stablecoin-smart-contracts/blob/6c710b47e07f70c38207c50270f81e1d69c874c8/contracts/main/stablecoin-core/StableSwapModule.sol#L272) in the `StableSwapModule` contract the variables `totalTokenFeeBalance`,`totalFXDFeeBalance`,`totalValueDeposited` are not zeroed.

```solidity
 function emergencyWithdraw(address _account) external override nonReentrant onlyOwnerOrGov whenPaused {
    require(_account != address(0), "withdrawFees/empty-account");
    tokenBalance[token] = 0;
    tokenBalance[stablecoin] = 0;
    token.safeTransfer(_account, token.balanceOf(address(this)));
    stablecoin.safeTransfer(_account, stablecoin.balanceOf(address(this)));
    emit LogEmergencyWithdraw(_account);
}
```
When the protocol gets unpaused and new liquidity added, the `totalValueDeposited` will contain a sum of "totalValueDeposited before pause" and "just added liquidity", resulting in wrong output of `_checkSingleSwapLimit` and `_dailySwapLimit`: the maximum exchange limit will be much higher than the entire liquidity of the protocol, as well as the daily limit.

Also, the values of `totalTokenFeeBalance` and `totalFXDFeeBalance` will be incorrect because the liquidity has already been withdrawn and the owner has taken this commission and will be able to do it again.

Also in the functions [`swapStablecoinToToken`](https://github.com/Into-the-Fathom/fathom-stablecoin-smart-contracts/tree/6c710b47e07f70c38207c50270f81e1d69c874c8/contracts/main/stablecoin-core/StableSwapModule.sol#L238), [`swapTokenToStablecoin`](https://github.com/Into-the-Fathom/fathom-stablecoin-smart-contracts/tree/6c710b47e07f70c38207c50270f81e1d69c874c8/contracts/main/stablecoin-core/StableSwapModule.sol#L181)  the `totalValueDeposited` variable is not updated to account for the fees accrued, which affects swap limits calculations.

##### Fix
`totalValueDeposited`, `totalTokenFeeBalance`, `totalFXDFeeBalance` set to zero upon emergencyWithdraw, with addition of function  `udpateTotalValueDeposited()`, to manage storage of totalValueDeposited


##### Updagrading contracts
1. update `upgrade-contracts-SSM.js` script with actual addresses. This script will upgrade the SSM contract with fixes and will call update totalValueDeposited
2. run `coralx execute --network {network} --path scripts/upgrades/0_062023/zeroedInEmergencyWithdraw-SSM-fix/upgrade-contracts-SSM.js`


##### Features still Not Available as of yet:
1. Accounting for fees
2. Correct way of handling swap limits after accounting for fees
3. Handle Emergency Scenarios with Wrapper
4. Deposit Tokens allowed only relative to balance available on stableswap
