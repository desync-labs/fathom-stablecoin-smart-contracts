// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.7.0) (governance/IGovernor.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../../common/structs/Timers.sol";

struct ProposalCore {
    Timers.BlockNumber voteStart;
    Timers.BlockNumber voteEnd;
    bool executed;
    bool canceled;
    uint256 expireTimestamp;
}
