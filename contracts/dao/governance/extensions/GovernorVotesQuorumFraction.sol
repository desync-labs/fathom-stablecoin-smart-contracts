// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.5.0) +
//              (governance/extensions/GovernorVotesQuorumFraction.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "./GovernorVotes.sol";

abstract contract GovernorVotesQuorumFraction is GovernorVotes {
    uint256 private _quorumNumerator;
    uint256 public constant MINIMUM_QUORUM_NUMERATOR = uint256(2);
    event QuorumNumeratorUpdated(uint256 oldQuorumNumerator, uint256 newQuorumNumerator);

    error QuorumNumeratorOverflow();
    error QuorumNumeratorUnderflow();

    /**
     * @dev Initialize quorum as a fraction of the token's total supply.
     *
     * The fraction is specified as `numerator / denominator`. By default the denominator is 100, so quorum is
     * specified as a percent: a numerator of 10 corresponds to quorum being 10% of total supply. The denominator can be
     * customized by overriding {quorumDenominator}.
     */
    constructor(uint256 quorumNumeratorValue) {
        _updateQuorumNumerator(quorumNumeratorValue);
    }

    /**
     * @dev Changes the quorum numerator.
     *
     * Emits a {QuorumNumeratorUpdated} event.
     *
     * Requirements:
     *
     * - Must be called through a governance proposal.
     * - New numerator must be smaller or equal to the denominator.
     */
    function updateQuorumNumerator(uint256 newQuorumNumerator) external virtual onlyGovernance {
        _updateQuorumNumerator(newQuorumNumerator);
    }

    function quorumNumerator() public view virtual returns (uint256) {
        return _quorumNumerator;
    }

    function quorumDenominator() public view virtual returns (uint256) {
        return 100;
    }

    /**
     * @dev Returns the quorum for a block number, in terms of number of votes: `supply * numerator / denominator`.
     */
    function quorum(uint256 blockNumber) public view virtual override returns (uint256) {
        return (token.getPastTotalSupply(blockNumber) * quorumNumerator()) / quorumDenominator();
    }

    function _updateQuorumNumerator(uint256 newQuorumNumerator) internal virtual {
        if (newQuorumNumerator > quorumDenominator()) {
            revert QuorumNumeratorOverflow();
        }
        if (newQuorumNumerator < MINIMUM_QUORUM_NUMERATOR) {
            revert QuorumNumeratorUnderflow();
        }
        uint256 oldQuorumNumerator = _quorumNumerator;
        _quorumNumerator = newQuorumNumerator;

        emit QuorumNumeratorUpdated(oldQuorumNumerator, newQuorumNumerator);
    }
}
