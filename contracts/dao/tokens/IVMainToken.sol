// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.7.0) (governance/IGovernor.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

interface IVMainToken {
    event MemberAddedToAllowlist(address _member);
    event MemberRemovedFromAllowlist(address _member);

    function initToken(address _admin, address _minter) external;

    function pause() external;

    function unpause() external;

    function mint(address to, uint256 amount) external;

    function burn(address account, uint256 amount) external;

    function grantMinterRole(address _minter) external;

    function revokeMinterRole(address _minter) external;
}
