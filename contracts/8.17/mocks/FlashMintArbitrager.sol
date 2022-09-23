// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@alpaca-finance/alpaca-contract/contracts/6/protocol/apis/pancake/IPancakeRouter02.sol";
// import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

import "../interfaces/IERC3156FlashBorrower.sol";
import "../interfaces/IStableSwapModule.sol";
import "../interfaces/IStablecoinAdapter.sol";
import "../utils/SafeToken.sol";

contract FlashMintArbitrager is OwnableUpgradeable, IERC3156FlashBorrower {
  using SafeToken for address;

  // --- Init ---
  function initialize() external initializer {
    // 1. Initialized all dependencies
    OwnableUpgradeable.__Ownable_init();
  }

  function onFlashLoan(
    address initiator,
    address token,
    uint256 amount,
    uint256 fee,
    bytes calldata data
  ) external override returns (bytes32) {
    (address router, address stableSwapToken, address stableSwapModule) = abi.decode(data, (address, address, address));
    address[] memory path = new address[](2);
    path[0] = token;
    path[1] = stableSwapToken;

    // 1. Swap AUSD to BUSD at a DEX
    uint256 balanceBefore = stableSwapToken.myBalance();
    token.safeApprove(router, type(uint256).max);
    IPancakeRouter02(router).swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp);
    token.safeApprove(router, 0);
    uint256 balanceAfter = stableSwapToken.myBalance();

    // 2. Swap BUSD to AUSD at StableSwapModule
    stableSwapToken.safeApprove(address(IStableSwapModule(stableSwapModule).authTokenAdapter()), type(uint256).max);
    IStableSwapModule(stableSwapModule).swapTokenToStablecoin(address(this), balanceAfter - balanceBefore);
    stableSwapToken.safeApprove(address(IStableSwapModule(stableSwapModule).authTokenAdapter()), 0);

    // 3. Approve AUSD for FlashMintModule
    token.safeApprove(msg.sender, amount + fee);

    return keccak256("ERC3156FlashBorrower.onFlashLoan");
  }
}
