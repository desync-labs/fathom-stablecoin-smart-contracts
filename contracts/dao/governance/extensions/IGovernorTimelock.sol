// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts v4.4.1 (governance/extensions/IGovernorTimelock.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../interfaces/IGovernor.sol";

abstract contract IGovernorTimelock is IGovernor {
    event ProposalQueued(uint256 proposalId, uint256 eta);

    function queue(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        bytes32 descriptionHash
    ) external virtual returns (uint256 proposalId);

    function timelock() external view virtual returns (address);

    function proposalEta(uint256 proposalId) external view virtual returns (uint256);
}
