// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.7.0) (governance/IGovernor.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../GovernorStructs.sol";
import "../../../common/introspection/ERC165.sol";

abstract contract IGovernor is IERC165 {
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas,
        uint256 startBlock,
        uint256 indexed endBlock,
        string description
    );
    event ProposalCanceled(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId);
    // Note: `support` values should be seen as buckets. Their interpretation depends on the voting module used.
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight, string reason);
    // Note: `support` values should be seen as buckets. Their interpretation depends on the voting module used.
    // `params` are additional encoded parameters. Their intepepretation also depends on the voting module used.
    event VoteCastWithParams(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight, string reason, bytes params);

    function propose(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata description
    ) external virtual returns (uint256 proposalId);

    function cancelProposal(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        bytes32 descriptionHash
    ) external virtual returns (uint256);

    function execute(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        bytes32 descriptionHash
    ) external payable virtual returns (uint256 proposalId);

    function castVote(uint256 proposalId, uint8 support) external virtual returns (uint256 balance);

    function castVoteWithReason(uint256 proposalId, uint8 support, string calldata reason) external virtual returns (uint256 balance);

    function castVoteWithReasonAndParams(
        uint256 proposalId,
        uint8 support,
        string calldata reason,
        bytes calldata params
    ) external virtual returns (uint256 balance);

    function castVoteBySig(uint256 proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s) external virtual returns (uint256 balance);

    function castVoteWithReasonAndParamsBySig(
        uint256 proposalId,
        uint8 support,
        string calldata reason,
        bytes calldata params,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual returns (uint256 balance);

    function getProposals(uint256 _numIndexes) external view virtual returns (string[] memory, string[] memory, string[] memory);

    function getDescription(uint256 _proposalId) external view virtual returns (string memory);

    function getProposalIds() external view virtual returns (uint256[] memory);

    function name() external view virtual returns (string memory);

    function version() external view virtual returns (string memory);

    function state(uint256 proposalId) external view virtual returns (ProposalState);

    function proposalSnapshot(uint256 proposalId) external view virtual returns (uint256);

    function proposalDeadline(uint256 proposalId) external view virtual returns (uint256);

    function getVotes(address account, uint256 blockNumber) external view virtual returns (uint256);

    function getVotesWithParams(address account, uint256 blockNumber, bytes calldata params) external view virtual returns (uint256);

    function hasVoted(uint256 proposalId, address account) external view virtual returns (bool);

    /**
     * @dev A description of the possible `support` values for {castVote} and the way these votes are counted, meant to
     * be consumed by UIs to show correct vote options and interpret the results. The string is a URL-encoded
     * sequence of key-value pairs that each describe one aspect, for example `support=bravo&quorum=for,abstain`.
     *
     * There are 2 standard keys: `support` and `quorum`.
     *
     * - `support=bravo` refers to the vote options 0 = Against, 1 = For, 2 = Abstain, as in `GovernorBravo`.
     * - `quorum=bravo` means that only For votes are counted towards quorum.
     * - `quorum=for,abstain` means that both For and Abstain votes are counted towards quorum.
     *
     * If a counting module makes use of encoded `params`, it should  include this under a `params` key with a unique
     * name that describes the behavior. For example:
     *
     * - `params=fractional` might refer to a scheme where votes are divided fractionally between for/against/abstain.
     * - `params=erc721` might refer to a scheme where specific NFTs are delegated to vote.
     *
     * NOTE: The string can be decoded by the standard
     * https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams[`URLSearchParams`]
     * JavaScript class.
     */

    function hashProposal(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        bytes32 descriptionHash
    ) external pure virtual returns (uint256);

    function votingDelay() public view virtual returns (uint256);

    function votingPeriod() public view virtual returns (uint256);

    function quorum(uint256 blockNumber) public view virtual returns (uint256);
}
