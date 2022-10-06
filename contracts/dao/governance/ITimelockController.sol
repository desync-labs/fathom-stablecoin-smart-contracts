// SPDX-License-Identifier: MIT
// Copyright Fathom 2022

pragma solidity ^0.8.0;

/**
 * @dev Interface of the {Governor} core.
 *
 * _Available since v4.3._
 */
interface ITimelockController {
    function initialize(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors
    ) external;
}
