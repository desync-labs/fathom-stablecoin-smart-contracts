// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "./IBookKeeperFlashBorrower.sol";

interface IBookKeeperFlashLender {
    /**
     * @dev Initiate a flash loan.
     * @param _receiver The receiver of the tokens in the loan, and the receiver of the callback.
     * @param _amount The amount of tokens lent. [rad]
     * @param _data Arbitrary data structure, intended to contain user-defined parameters.
     */
    function bookKeeperFlashLoan(IBookKeeperFlashBorrower _receiver, uint256 _amount, bytes calldata _data) external returns (bool);
}
