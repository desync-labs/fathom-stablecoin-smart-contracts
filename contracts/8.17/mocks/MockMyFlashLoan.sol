// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "../flash-mint/base/FlashLoanReceiverBase.sol";

contract MockMyFlashLoan is FlashLoanReceiverBase {
  // --- Init ---
  constructor(address _flash) FlashLoanReceiverBase(_flash) {}

  function onFlashLoan(
    address initiator,
    address token,
    uint256 amount,
    uint256 fee,
    bytes calldata data
  ) external override returns (bytes32) {
    return CALLBACK_SUCCESS;
  }

  function onBookKeeperFlashLoan(
    address initiator,
    uint256 amount,
    uint256 fee,
    bytes calldata data
  ) external override returns (bytes32) {
    return CALLBACK_SUCCESS_BOOK_KEEPER_STABLE_COIN;
  }
}
