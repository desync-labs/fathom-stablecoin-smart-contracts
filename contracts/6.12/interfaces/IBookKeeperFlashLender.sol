// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "./IBookKeeperFlashBorrower.sol";

interface IBookKeeperFlashLender {
    /**
     * @dev Initiate a flash loan.
     * @param receiver The receiver of the tokens in the loan, and the receiver of the callback.
     * @param amount The amount of tokens lent. [rad]
     * @param data Arbitrary data structure, intended to contain user-defined parameters.
     */
    function bookKeeperFlashLoan(
        IBookKeeperFlashBorrower receiver,
        uint256 amount,
        bytes calldata data
    ) external returns (bool);
}
