// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts v4.4.1 (governance/extensions/GovernorSettings.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../Governor.sol";

abstract contract GovernorSettings is Governor {
    uint256 private _votingDelay;
    uint256 private _votingPeriod;
    uint256 private _proposalThreshold;

    event VotingDelaySet(uint256 oldVotingDelay, uint256 newVotingDelay);
    event VotingPeriodSet(uint256 oldVotingPeriod, uint256 newVotingPeriod);
    event ProposalThresholdSet(uint256 oldProposalThreshold, uint256 newProposalThreshold);

    error ZeroVotePeriod();
    error ZeroThreshold();

    constructor(uint256 initialVotingDelay, uint256 initialVotingPeriod, uint256 initialProposalThreshold) {
        _setVotingDelay(initialVotingDelay);
        _setVotingPeriod(initialVotingPeriod);
        _setProposalThreshold(initialProposalThreshold);
    }

    /**
     * @dev Has to go through proposals and successful voting to update by Governance
     */
    function setVotingDelay(uint256 newVotingDelay) external virtual onlyGovernance {
        _setVotingDelay(newVotingDelay);
    }

    /**
     * @dev Has to go through proposals and successful voting to update by Governance
     */
    function setVotingPeriod(uint256 newVotingPeriod) external virtual onlyGovernance {
        _setVotingPeriod(newVotingPeriod);
    }

    /**
     * @dev Has to go through proposals and successful voting to update by Governance
     */
    function setProposalThreshold(uint256 newProposalThreshold) external virtual onlyGovernance {
        _setProposalThreshold(newProposalThreshold);
    }

    function votingDelay() public view virtual override returns (uint256) {
        return _votingDelay;
    }

    function votingPeriod() public view virtual override returns (uint256) {
        return _votingPeriod;
    }

    function proposalThreshold() public view virtual override returns (uint256) {
        return _proposalThreshold;
    }

    function _setVotingDelay(uint256 newVotingDelay) internal virtual {
        emit VotingDelaySet(_votingDelay, newVotingDelay);
        _votingDelay = newVotingDelay;
    }

    function _setVotingPeriod(uint256 newVotingPeriod) internal virtual {
        if (newVotingPeriod == 0) {
            revert ZeroVotePeriod();
        }
        emit VotingPeriodSet(_votingPeriod, newVotingPeriod);
        _votingPeriod = newVotingPeriod;
    }

    function _setProposalThreshold(uint256 newProposalThreshold) internal virtual {
        if (newProposalThreshold == 0) {
            revert ZeroThreshold();
        }
        emit ProposalThresholdSet(_proposalThreshold, newProposalThreshold);
        _proposalThreshold = newProposalThreshold;
    }
}
