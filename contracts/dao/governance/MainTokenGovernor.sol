// SPDX-License-Identifier: MIT
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "./Governor.sol";
import "./interfaces/IRelay.sol";
import "./interfaces/ISupportingTokens.sol";
import "./interfaces/IEmergencyStop.sol";
import "./extensions/GovernorSettings.sol";
import "./extensions/GovernorCountingSimple.sol";
import "./extensions/GovernorVotes.sol";
import "./extensions/GovernorVotesQuorumFraction.sol";
import "./extensions/GovernorTimelockControl.sol";
import "../tokens/ERC20/IERC20.sol";
import "../../common/SafeERC20.sol";

contract MainTokenGovernor is
    IRelay,
    ISupportingTokens,
    IEmergencyStop,
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    using SafeERC20 for IERC20;
    mapping(address => bool) public isSupportedToken;
    address[] public listOfSupportedTokens;

    error TokenSupported();
    error TokenUnsupported();

    constructor(
        IVotes _token,
        TimelockController _timelock,
        address _multiSig,
        uint256 _initialVotingDelay,
        uint256 _votingPeriod,
        uint256 _initialProposalThreshold,
        uint256 _proposalTimeDelay,
        uint256 _proposalLifetime
    )
        Governor("MainTokenGovernor", _multiSig, 20, _proposalTimeDelay, _proposalLifetime)
        GovernorSettings(_initialVotingDelay, _votingPeriod, _initialProposalThreshold)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4)
        GovernorTimelockControl(_timelock)
    {}

    /**
     * @dev Relays a transaction or function call to an arbitrary target. In cases where the governance executor
     * is some contract other than the governor itself, like when using a timelock, this function can be invoked
     * in a governance proposal to recover tokens that was sent to the governor contract by mistake.
     * Note that if the executor is simply the governor itself, use of `relay` is redundant.
     */
    function relayERC20(address target, bytes calldata data) external virtual override onlyGovernance {
        if (!isSupportedToken[target]) {
            revert TokenUnsupported();
        }
        (bool success, bytes memory returndata) = target.call(data);
        Address.verifyCallResult(success, returndata, "empty revert");
    }

    /**
     * @dev Relays a transaction or function call to an arbitrary target. In cases where the governance executor
     * is some contract other than the governor itself, like when using a timelock, this function can be invoked
     * in a governance proposal to recover Ether that was sent to the governor contract by mistake.
     * Note that if the executor is simply the governor itself, use of `relay` is redundant.
     */
    function relayNativeToken(address target, uint256 value, bytes calldata data) external payable virtual override onlyGovernance {
        if (isSupportedToken[target]) {
            revert TokenSupported();
        }
        (bool success, bytes memory returndata) = target.call{ value: value }(data);
        Address.verifyCallResult(success, returndata, "empty revert");
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor, IGovernor) returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }

    /**
     * @dev Cancelling of proposal can be done only through Multisig
     */
    function cancelProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public override onlyMultiSig returns (uint256) {
        return _cancel(targets, values, calldatas, descriptionHash);
    }

    /**
     * @dev A multisig can stop this contract. Once stopped we will have to migrate.
     *     Once this function is called, the contract cannot be made live again.
     */
    function emergencyStop() public override onlyMultiSig {
        _emergencyStop();
        for (uint256 i = 0; i < listOfSupportedTokens.length; i++) {
            address _token = listOfSupportedTokens[i];
            uint256 balanceInContract = IERC20(_token).balanceOf(address(this));
            if (balanceInContract > 0) {
                IERC20(_token).safeTransfer(msg.sender, balanceInContract);
            }
        }
        if (address(this).balance > 0) {
            (bool sent, ) = msg.sender.call{ value: (address(this).balance) }("");
            if (!sent) {
                revert FailedToSendEther();
            }
        }
    }

    /**
     * @dev Adds supporting tokens so that if there are tokens then it can be transferred
     *     Only Governance is able to access this function.
     *     It has to go through proposal and successful voting for execution.
     */
    function addSupportingToken(address _token) public override onlyGovernance {
        _addSupportedToken(_token);
    }

    /**
     * @dev Removes supporting tokens
     *      Only Governance is able to access this function.
     *      It has to go through proposal and successful voting for execution.
     */
    function removeSupportingToken(address _token) public override onlyGovernance {
        _removeSupportingToken(_token);
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function supportsInterface(bytes4 interfaceId) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function votingDelay() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber) public view override(IGovernor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }

    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }

    function _addSupportedToken(address _token) internal {
        if (isSupportedToken[_token]) {
            revert TokenSupported();
        }
        isSupportedToken[_token] = true;
        listOfSupportedTokens.push(_token);
    }

    function _removeSupportingToken(address _token) internal {
        if (!isSupportedToken[_token]) {
            revert TokenUnsupported();
        }
        isSupportedToken[_token] = false;
        for (uint256 i = 0; i < listOfSupportedTokens.length; i++) {
            if (listOfSupportedTokens[i] == _token) {
                listOfSupportedTokens[i] = listOfSupportedTokens[listOfSupportedTokens.length - 1];
                break;
            }
        }
        listOfSupportedTokens.pop();
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        if (!isConfirmed[proposalId]) {
            revert ProposalNotConfirmed();
        }
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }
}
