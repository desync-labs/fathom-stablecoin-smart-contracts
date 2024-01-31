// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IBookKeeperFlashBorrower {
    /// @dev Receive a flash loan.
    /// @param _initiator The initiator of the loan.
    /// @param _amount The amount of tokens lent. [rad]
    /// @param _fee The additional amount of tokens to repay. [rad]
    /// @param _data Arbitrary data structure, intended to contain user-defined parameters.
    /// @return The keccak256 hash of "IBookKeeperFlashLoanReceiver.onBookKeeperFlashLoan"
    function onBookKeeperFlashLoan(address _initiator, uint256 _amount, uint256 _fee, bytes calldata _data) external returns (bytes32);
}
