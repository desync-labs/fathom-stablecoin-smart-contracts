// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.5.0) (token/ERC20/utils/TokenTimelock.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../../../../common/SafeERC20.sol";

/**
 * @dev A token holder contract that will allow a beneficiary to extract the
 * tokens after a given release time.
 *
 * Useful for simple vesting schedules like "advisors get all of their tokens
 * after 1 year".
 */
interface ITokenTimelock {
    /**
     * @dev Transfers tokens held by the timelock to the beneficiary. Will only succeed if invoked after the release
     * time.
     */
    function release() external;

    /**
     * @dev Returns the token being held.
     */
    function token() external view returns (IERC20);

    /**
     * @dev Returns the beneficiary that will receive the tokens.
     */
    function beneficiary() external view returns (address);

    /**
     * @dev Returns the time when the tokens are released in seconds since Unix epoch (i.e. Unix timestamp).
     */
    function releaseTime() external view returns (uint256);
}
