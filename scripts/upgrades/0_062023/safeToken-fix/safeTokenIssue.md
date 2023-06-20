#### Issue `safeTransfer` function will succeed when calling to non-contract account in `SafeToken`
##### Description
In the function [`safeTransfer`](https://github.com/Into-the-Fathom/fathom-stablecoin-smart-contracts/blob/6c710b47e07f70c38207c50270f81e1d69c874c8/contracts/main/utils/SafeToken.sol#L22-L25) in the `SafeToken` library if non-contract address will be passed to `token` parameter, the call will be considered successful. This will be recorded in a protocol state as a successful transfer while no tokens were in fact transfered.

Same applies to [`safeTransferFrom`](https://github.com/Into-the-Fathom/fathom-stablecoin-smart-contracts//tree/6c710b47e07f70c38207c50270f81e1d69c874c8/contracts/main/utils/SafeToken.sol#L27) and [`safeApprove`](https://github.com/Into-the-Fathom/fathom-stablecoin-smart-contracts/blob/6c710b47e07f70c38207c50270f81e1d69c874c8/contracts/main/utils/SafeToken.sol#Lw17).

This scenario can be observed throughout the code base.

As an example, the function [`swapTokenToStablecoin`](https://github.com/Into-the-Fathom/fathom-stablecoin-smart-contracts/blob/6c710b47e07f70c38207c50270f81e1d69c874c8/contracts/main/stablecoin-core/StableSwapModule.sol#L200) sends stablecoins to the user, but if the stablecoin contract address was specified incorrectly, user will have their tokens transfered to the `StableSwapModule` contract balance but won't receive the stablecoin, the transaction won't revert.

##### Fix
`Address.isContract(token)` is added for all the transfers and approve function in the SafeToken library

##### Upgrading Contracts:
Contracts needed to upgrade:
* FlashMintModule.sol
* FlashLoanReceiverBase.sol
* FathomStablecoinProxyActions.sol
* StableSwapModule.sol
* StableSwapModuleWrapper.sol
* CollateralTokenAdapter.sol
* FixedSpreadLiquidationStrategy.sol
* BookKeeperFlashMintArbitrager.sol
* FlashMintArbitrager.sol
* TokenAdapter.sol

