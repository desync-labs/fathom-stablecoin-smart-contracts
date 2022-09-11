// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.7.0) (governance/IGovernor.sol)
// Copyright Fathom 2022

pragma solidity ^0.8.0;

/**
 * @dev Interface of the {Governor} core.
 *
 * _Available since v4.3._
 */

interface IVeMainToken {
    // events
    event MemberAddedToWhitelist(address _member);
    event MemberRemovedFromWhitelist(address _member);

    /**
     * @dev Whitelist a sender allowing them to transfer ve tokens.
     */
    function addToWhitelist(address _toAdd) external;

    /**
     * @dev Remove ability of a whitelisted sender to transfer ve tokens.
     */
    function removeFromWhitelist(address _toRemove) external;

    function pause() external;

    function unpause() external;

    function mint(address to, uint256 amount) external;

    function burn(address account, uint256 amount) external;
}
