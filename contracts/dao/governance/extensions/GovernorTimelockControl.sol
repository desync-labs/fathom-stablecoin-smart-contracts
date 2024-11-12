// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.6.0) (governance/extensions/GovernorTimelockControl.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "./IGovernorTimelock.sol";
import "../Governor.sol";
import "../TimelockController.sol";

abstract contract GovernorTimelockControl is IGovernorTimelock, Governor {
    TimelockController private _timelock;
    mapping(uint256 => bytes32) private _timelockIds;
    mapping(uint256 => bool) private isProposalExecuted;
    event TimelockChange(address oldTimelock, address newTimelock);

    error NotConfirmed();
    error NotSuccessful();
    error AlreadyExecuted();

    constructor(TimelockController timelockAddress) {
        _updateTimelock(timelockAddress);
    }

    // Warning: It is not recommended to change the timelock while there are other queued governance proposals.
    function updateTimelock(TimelockController newTimelock) external virtual onlyGovernance {
        _updateTimelock(newTimelock);
    }

    /**
     * @notice The proposal must be confirmed by multisig before it can be queued
     */
    function queue(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        bytes32 descriptionHash
    ) external virtual override returns (uint256) {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        if (!isConfirmed[proposalId]) {
            revert NotConfirmed();
        }
        if (state(proposalId) != ProposalState.Succeeded) {
            revert NotSuccessful();
        }

        uint256 delay = _timelock.getMinDelay();
        _timelockIds[proposalId] = _timelock.hashOperationBatch(targets, values, calldatas, 0, descriptionHash);
        _timelock.scheduleBatch(targets, values, calldatas, 0, descriptionHash, delay);

        // solhint-disable-next-line
        emit ProposalQueued(proposalId, block.timestamp + delay);

        return proposalId;
    }

    function timelock() external view virtual override returns (address) {
        return address(_timelock);
    }

    function proposalEta(uint256 proposalId) external view virtual override returns (uint256) {
        uint256 eta = _timelock.getTimestamp(_timelockIds[proposalId]);
        return eta == 1 ? 0 : eta; // _DONE_TIMESTAMP (1) should be replaced with a 0 value
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165, Governor) returns (bool) {
        return interfaceId == type(IGovernorTimelock).interfaceId || super.supportsInterface(interfaceId);
    }

    function state(uint256 proposalId) public view virtual override(IGovernor, Governor) returns (ProposalState) {
        ProposalState status = super.state(proposalId);

        if (status != ProposalState.Succeeded) {
            return status;
        }

        bytes32 queueid = _timelockIds[proposalId];
        if (queueid == bytes32(0)) {
            return status;
        } else if (isProposalExecuted[proposalId]) {
            return ProposalState.Executed;
        } else if (_timelock.isOperationPending(queueid)) {
            return ProposalState.Queued;
        } else {
            return ProposalState.Canceled;
        }
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal virtual override {
        if (isProposalExecuted[proposalId]) {
            revert AlreadyExecuted();
        }
        _timelock.executeBatch{ value: msg.value }(targets, values, calldatas, 0, descriptionHash);
        isProposalExecuted[proposalId] = true;
    }

    // This function can reenter through the external call to the timelock, but we assume the timelock is trusted and
    // well behaved (according to TimelockController) and this will not happen.
    // slither-disable-next-line reentrancy-no-eth
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal virtual override returns (uint256) {
        uint256 proposalId = super._cancel(targets, values, calldatas, descriptionHash);

        if (_timelockIds[proposalId] != 0) {
            _timelock.cancel(_timelockIds[proposalId]);
            delete _timelockIds[proposalId];
        }

        return proposalId;
    }

    function _executor() internal view virtual override returns (address) {
        return address(_timelock);
    }

    function _updateTimelock(TimelockController newTimelock) private {
        if (address(newTimelock) == address(0)) {
            revert ZeroAddress();
        }
        emit TimelockChange(address(_timelock), address(newTimelock));
        _timelock = newTimelock;
    }
}
