// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.5.0) (governance/utils/IVotes.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

interface IVotes {
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);

    function delegate(address delegatee) external;

    function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external;

    function getVotes(address account) external view returns (uint256);

    function getPastVotes(address account, uint256 blockNumber) external view returns (uint256);

    function getPastTotalSupply(uint256 blockNumber) external view returns (uint256);

    function delegates(address account) external view returns (address);
}
