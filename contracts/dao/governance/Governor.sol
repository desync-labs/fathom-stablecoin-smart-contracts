// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.7.0) (governance/Governor.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../../common/cryptography/ECDSA.sol";
import "../../common/cryptography/EIP712.sol";
import "../../common/introspection/ERC165.sol";
import "../../common/math/SafeCast.sol";
import "../../common/structs/DoubleEndedQueue.sol";
import "../../common/Address.sol";
import "../../common/Context.sol";
import "../../common/Strings.sol";
import "./GovernorStructs.sol";
import "./interfaces/IGovernor.sol";

// solhint-disable not-rely-on-time
abstract contract Governor is Context, ERC165, EIP712, IGovernor {
    using DoubleEndedQueue for DoubleEndedQueue.Bytes32Deque;
    using SafeCast for uint256;
    using Strings for *;
    using Timers for Timers.BlockNumber;

    uint256 public maxTargets;
    uint256 public proposalTimeDelay;
    uint256 public live;
    uint256 public proposalLifetime;
    mapping(address => bool) public isBlocklisted;
    mapping(uint256 => bool) public isConfirmed;
    mapping(address => uint256) public nextAcceptableProposalTimestamp;

    mapping(uint256 => ProposalCore) internal _proposals;
    mapping(uint256 => string) internal _descriptions;

    address private multiSig;
    string private _name;
    uint256[] private _proposalIds;
    DoubleEndedQueue.Bytes32Deque private _governanceCall;

    uint256 public constant MINIMUM_LIFETIME = 86400; //oneDay
    bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,uint8 support)");
    bytes32 public constant EXTENDED_BALLOT_TYPEHASH = keccak256("ExtendedBallot(uint256 proposalId,uint8 support,string reason,bytes params)");

    event ConfirmProposal(address indexed signer, uint256 indexed proposalId);
    event RevokeConfirmation(address indexed signer, uint256 indexed proposalId);
    event ExecuteProposal(address indexed owner, bool indexed success, bytes data);
    event MultiSigUpdated(address newMultiSig, address oldMultiSig);
    event MaxTargetUpdated(uint256 newMaxTargets, uint256 oldMaxTargets);
    event ProposalTimeDelayUpdated(uint256 newProposalTimeDelay, uint256 oldProposalTimeDelay);
    event ProposalLifetimeUpdated(uint256 newProposalLifetime, uint256 oldProposalLifetime);
    event BlocklistStatusUpdated(address indexed account, bool isBlocklisted);
    event EmergencyStop();

    error NotLive();
    error OnlyOvernance();
    error OnlyMultiSig();
    error ProposalAlreadyExecuted();
    error ProposalAlreadyConfirmed();
    error ProposalNotActive();
    error ZeroTargets();
    error ZeroDelay();
    error LowLifetime();
    error ZeroAddress();
    error ZeroValue();
    error OnlyExecutor();
    error ProposalNotQueued();
    error InsufficientFunds();
    error FailedToSendEther();
    error InsufficientVotes();
    error ProposerIsBlocklisted();
    error InvalidProposalLength();
    error EmptyProposal();
    error MaxTargetLength();
    error ProposalAlreadyExists();
    error LessThanMinimum();
    error ProposalNotSuccessful();
    error ProposalDelayNotPassed();
    error ProposalExpired();
    error ProposalNotConfirmed();
    error UnknownProposal();

    modifier onlyGovernance() {
        if (_msgSender() != _executor()) {
            revert OnlyOvernance();
        }
        if (_executor() != address(this)) {
            bytes32 msgDataHash = keccak256(_msgData());
            // loop until popping the expected operation - throw if deque is empty (operation not authorized)
            while (_governanceCall.popFront() != msgDataHash) {}
        }
        _;
    }

    modifier onlyMultiSig() {
        if (_msgSender() != multiSig) {
            revert OnlyMultiSig();
        }
        _;
    }

    modifier notExecuted(uint256 _proposalId) {
        if (_proposals[_proposalId].executed) {
            revert ProposalAlreadyExecuted();
        }
        _;
    }

    modifier notConfirmed(uint256 _proposalId) {
        if (isConfirmed[_proposalId]) {
            revert ProposalAlreadyConfirmed();
        }
        _;
    }

    // solhint-disable code-complexity
    modifier verifyProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas
    ) {
        if (live != 1) {
            revert NotLive();
        }
        if (getVotes(_msgSender(), block.number - 1) < proposalThreshold()) {
            revert InsufficientVotes();
        }
        if (isBlocklisted[msg.sender]) {
            revert ProposerIsBlocklisted();
        }
        _checkNextProposalDelayPassed(msg.sender);

        if (targets.length != values.length) {
            revert InvalidProposalLength();
        }
        if (targets.length != calldatas.length) {
            revert InvalidProposalLength();
        }
        if (targets.length == 0) {
            revert EmptyProposal();
        }
        if (targets.length > maxTargets) {
            revert MaxTargetLength();
        }
        _;
    }

    // solhint-enable code-complexity

    constructor(
        string memory name_,
        address multiSig_,
        uint256 maxTargets_,
        uint256 proposalTimeDelay_,
        uint256 proposalLifetime_
    ) EIP712(name_, version()) {
        if (multiSig_ == address(0)) {
            revert ZeroAddress();
        }
        if (maxTargets_ == 0) {
            revert ZeroTargets();
        }
        if (proposalTimeDelay_ == 0) {
            revert ZeroDelay();
        }
        if (proposalLifetime_ < MINIMUM_LIFETIME) {
            revert LowLifetime();
        }
        _name = name_;
        multiSig = multiSig_;
        maxTargets = maxTargets_;
        proposalTimeDelay = proposalTimeDelay_;
        proposalLifetime = proposalLifetime_;
        live = 1;
    }

    receive() external payable virtual {
        if (_executor() != address(this)) {
            revert OnlyExecutor();
        }
    }

    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable virtual override returns (uint256) {
        if (live != 1) {
            revert NotLive();
        }
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        _requireNotExpired(proposalId);
        _requireConfirmed(proposalId);

        ProposalState status = state(proposalId);
        if (status != ProposalState.Queued) {
            revert ProposalNotQueued();
        }
        uint256 totalValue = 0;
        for (uint256 i = 0; i < values.length; i++) {
            totalValue += values[i];
        }
        if (msg.value < totalValue) {
            revert InsufficientFunds();
        }
        _proposals[proposalId].executed = true;

        emit ProposalExecuted(proposalId);

        _beforeExecute(proposalId, targets, values, calldatas, descriptionHash);
        _execute(proposalId, targets, values, calldatas, descriptionHash);
        _afterExecute(proposalId, targets, values, calldatas, descriptionHash);
        if (msg.value > totalValue) {
            (bool sent, ) = msg.sender.call{ value: (msg.value - totalValue) }("");
            if (!sent) {
                revert FailedToSendEther();
            }
        }
        return proposalId;
    }

    function castVote(uint256 proposalId, uint8 support) public virtual override returns (uint256) {
        if (live != 1) {
            revert NotLive();
        }
        address voter = _msgSender();
        return _castVote(proposalId, voter, support, "");
    }

    function castVoteWithReason(uint256 proposalId, uint8 support, string memory reason) public virtual override returns (uint256) {
        if (live != 1) {
            revert NotLive();
        }
        address voter = _msgSender();
        return _castVote(proposalId, voter, support, reason);
    }

    function castVoteWithReasonAndParams(
        uint256 proposalId,
        uint8 support,
        string memory reason,
        bytes memory params
    ) public virtual override returns (uint256) {
        if (live != 1) {
            revert NotLive();
        }
        address voter = _msgSender();
        return _castVote(proposalId, voter, support, reason, params);
    }

    function castVoteBySig(uint256 proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s) public virtual override returns (uint256) {
        if (live != 1) {
            revert NotLive();
        }
        address voter = ECDSA.recover(_hashTypedDataV4(keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, support))), v, r, s);
        return _castVote(proposalId, voter, support, "");
    }

    function castVoteWithReasonAndParamsBySig(
        uint256 proposalId,
        uint8 support,
        string memory reason,
        bytes memory params,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual override returns (uint256) {
        if (live != 1) {
            revert NotLive();
        }
        address voter = ECDSA.recover(
            _hashTypedDataV4(keccak256(abi.encode(EXTENDED_BALLOT_TYPEHASH, proposalId, support, keccak256(bytes(reason)), keccak256(params)))),
            v,
            r,
            s
        );

        return _castVote(proposalId, voter, support, reason, params);
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public virtual override verifyProposal(targets, values, calldatas) returns (uint256) {
        uint256 proposalId = hashProposal(targets, values, calldatas, keccak256(bytes(description)));

        ProposalCore storage proposal = _proposals[proposalId];
        if (proposal.voteStart.isStarted()) {
            revert ProposalAlreadyExists();
        }

        return _propose(proposalId, proposal, targets, values, calldatas, description);
    }

    /**
     * @dev Only Multisig is able to confirm a proposal
     */
    function confirmProposal(uint256 _proposalId) public onlyMultiSig notExecuted(_proposalId) notConfirmed(_proposalId) {
        _requireNotExpired(_proposalId);
        isConfirmed[_proposalId] = true;
        ProposalState status = state(_proposalId);
        if (status != ProposalState.Succeeded && status != ProposalState.Queued) {
            revert ProposalNotSuccessful();
        }
        emit ConfirmProposal(msg.sender, _proposalId);
    }

    /**
     * @dev Only Multisig is able to revoke a proposal confirmation
     */
    function revokeConfirmation(uint256 _proposalId) public onlyMultiSig notExecuted(_proposalId) {
        _requireConfirmed(_proposalId);
        isConfirmed[_proposalId] = false;
        emit RevokeConfirmation(msg.sender, _proposalId);
    }

    /**
     * @dev Only Multisig can update
     */
    function updateMultiSig(address newMultiSig) public onlyMultiSig {
        if (newMultiSig == address(0)) {
            revert ZeroAddress();
        }
        emit MultiSigUpdated(newMultiSig, multiSig);
        multiSig = newMultiSig;
    }

    /**
     * @dev Only Multisig can update
     */
    function updateMaxTargets(uint256 newMaxTargets) public onlyMultiSig {
        if (newMaxTargets == 0) {
            revert ZeroValue();
        }
        emit MaxTargetUpdated(newMaxTargets, maxTargets);
        maxTargets = newMaxTargets;
    }

    /**
     * @dev Only Multisig can update
     */
    function updateProposalTimeDelay(uint256 newProposalTimeDelay) public onlyMultiSig {
        if (newProposalTimeDelay == 0) {
            revert ZeroValue();
        }
        emit ProposalTimeDelayUpdated(newProposalTimeDelay, proposalTimeDelay);
        proposalTimeDelay = newProposalTimeDelay;
    }

    /**
     * @dev Only Multisig can update
     */
    function updateProposalLifetime(uint256 newProposalLifetime) public onlyMultiSig {
        if (newProposalLifetime < MINIMUM_LIFETIME) {
            revert LessThanMinimum();
        }
        emit ProposalLifetimeUpdated(newProposalLifetime, newProposalLifetime);
        proposalLifetime = newProposalLifetime;
    }

    /**
     * @dev Only Multisig can blocklist a an account or unblocklist an account
     */
    function setBlocklistStatusForProposer(address account, bool blocklistStatus) public onlyMultiSig {
        isBlocklisted[account] = blocklistStatus;
        emit BlocklistStatusUpdated(account, blocklistStatus);
    }

    function getProposals(uint256 _numIndexes) public view override returns (string[] memory, string[] memory, string[] memory) {
        uint256 len = _proposalIds.length;

        if (len == 0) {
            string[] memory a;
            string[] memory b;
            string[] memory c;
            return (a, b, c);
        } else if (_numIndexes > len) {
            _numIndexes = len;
        }

        return _getProposals1(_numIndexes);
    }

    function getProposalIds() public view override returns (uint256[] memory) {
        return _proposalIds;
    }

    function getDescription(uint256 _proposalId) public view override returns (string memory) {
        return _descriptions[_proposalId];
    }

    function getVotes(address account, uint256 blockNumber) public view virtual override returns (uint256) {
        return _getVotes(account, blockNumber, _defaultParams());
    }

    function getVotesWithParams(address account, uint256 blockNumber, bytes memory params) public view virtual override returns (uint256) {
        return _getVotes(account, blockNumber, params);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165, ERC165) returns (bool) {
        return
            interfaceId ==
            (type(IGovernor).interfaceId ^
                this.castVoteWithReasonAndParams.selector ^
                this.castVoteWithReasonAndParamsBySig.selector ^
                this.getVotesWithParams.selector) ||
            interfaceId == type(IGovernor).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function version() public view virtual override returns (string memory) {
        return "1";
    }

    function state(uint256 proposalId) public view virtual override returns (ProposalState) {
        ProposalCore storage proposal = _proposals[proposalId];

        if (proposal.executed) {
            return ProposalState.Executed;
        }

        if (proposal.canceled) {
            return ProposalState.Canceled;
        }

        uint256 snapshot = proposalSnapshot(proposalId);

        if (snapshot == 0) {
            revert UnknownProposal();
        }

        if (snapshot >= block.number) {
            return ProposalState.Pending;
        }

        uint256 deadline = proposalDeadline(proposalId);

        if (deadline >= block.number) {
            return ProposalState.Active;
        }

        if (_quorumReached(proposalId) && _voteSucceeded(proposalId)) {
            return ProposalState.Succeeded;
        } else {
            return ProposalState.Defeated;
        }
    }

    function proposalSnapshot(uint256 proposalId) public view virtual override returns (uint256) {
        return _proposals[proposalId].voteStart.getDeadline();
    }

    function proposalDeadline(uint256 proposalId) public view virtual override returns (uint256) {
        return _proposals[proposalId].voteEnd.getDeadline();
    }

    function proposalThreshold() public view virtual returns (uint256) {
        return 0;
    }

    function hashProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public pure virtual override returns (uint256) {
        return uint256(keccak256(abi.encode(targets, values, calldatas, descriptionHash)));
    }

    function _propose(
        uint256 proposalId,
        ProposalCore storage proposal,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) internal virtual returns (uint256) {
        uint64 snapshot = block.number.toUint64() + votingDelay().toUint64();
        uint64 deadline = snapshot + votingPeriod().toUint64();

        proposal.voteStart.setDeadline(snapshot);
        proposal.voteEnd.setDeadline(deadline);
        proposal.expireTimestamp = block.timestamp + proposalLifetime;
        _descriptions[proposalId] = description;

        _proposalIds.push(proposalId);

        emit ProposalCreated(proposalId, _msgSender(), targets, values, new string[](targets.length), calldatas, snapshot, deadline, description);
        return proposalId;
    }

    function _emergencyStop() internal {
        if (live != 1) {
            revert NotLive();
        }
        live = 0;
        emit EmergencyStop();
    }

    function _countVote(uint256 proposalId, address account, uint8 support, uint256 weight, bytes memory params) internal virtual;

    function _execute(
        uint256 /*proposalId*/,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 /*descriptionHash*/
    ) internal virtual {
        for (uint256 i = 0; i < targets.length; ++i) {
            (bool success, bytes memory returndata) = targets[i].call{ value: values[i] }(calldatas[i]);
            emit ExecuteProposal(msg.sender, success, returndata);
        }
    }

    function _beforeExecute(
        uint256 /* proposalId */,
        address[] memory targets,
        uint256[] memory /* values */,
        bytes[] memory calldatas,
        bytes32 /*descriptionHash*/
    ) internal virtual {
        if (_executor() != address(this)) {
            for (uint256 i = 0; i < targets.length; ++i) {
                if (targets[i] == address(this)) {
                    _governanceCall.pushBack(keccak256(calldatas[i]));
                }
            }
        }
    }

    function _afterExecute(
        uint256 /* proposalId */,
        address[] memory /* targets */,
        uint256[] memory /* values */,
        bytes[] memory /* calldatas */,
        bytes32 /*descriptionHash*/
    ) internal virtual {
        if (_executor() != address(this)) {
            if (!_governanceCall.empty()) {
                _governanceCall.clear();
            }
        }
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal virtual returns (uint256) {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        ProposalState status = state(proposalId);

        if (status == ProposalState.Canceled || status == ProposalState.Expired || status == ProposalState.Executed) {
            revert ProposalNotActive();
        }
        _proposals[proposalId].canceled = true;

        emit ProposalCanceled(proposalId);

        return proposalId;
    }

    function _castVote(uint256 proposalId, address account, uint8 support, string memory reason) internal virtual returns (uint256) {
        return _castVote(proposalId, account, support, reason, _defaultParams());
    }

    function _castVote(
        uint256 proposalId,
        address account,
        uint8 support,
        string memory reason,
        bytes memory params
    ) internal virtual returns (uint256) {
        ProposalCore storage proposal = _proposals[proposalId];
        if (state(proposalId) != ProposalState.Active) {
            revert ProposalNotActive();
        }

        uint256 weight = _getVotes(account, proposal.voteStart.getDeadline(), params);
        _countVote(proposalId, account, support, weight, params);

        if (params.length == 0) {
            emit VoteCast(account, proposalId, support, weight, reason);
        } else {
            emit VoteCastWithParams(account, proposalId, support, weight, reason, params);
        }

        return weight;
    }

    function _checkNextProposalDelayPassed(address account) internal {
        if (block.timestamp <= nextAcceptableProposalTimestamp[account]) {
            revert ProposalDelayNotPassed();
        }
        nextAcceptableProposalTimestamp[account] = block.timestamp + proposalTimeDelay;
    }

    function _getProposals1(uint256 _numIndexes) internal view returns (string[] memory, string[] memory, string[] memory) {
        string[] memory statuses = new string[](_numIndexes);
        string[] memory descriptionsArray = new string[](_numIndexes);
        string[] memory proposalIds = new string[](_numIndexes);

        uint256 counter = _proposalIds.length;

        uint256 indexCounter = _numIndexes - 1;

        if (_numIndexes >= counter) {
            indexCounter = counter - 1;
        }

        while (indexCounter >= 0) {
            uint256 _currentPropId = _proposalIds[counter - 1];
            proposalIds[indexCounter] = string(_currentPropId.toString());
            descriptionsArray[indexCounter] = _descriptions[_currentPropId];
            statuses[indexCounter] = (uint8(state(_currentPropId))).toString();

            if (counter - 1 == 0) {
                break;
            }
            if (indexCounter == 0) {
                break;
            }

            counter--;
            indexCounter--;
        }

        return (proposalIds, descriptionsArray, statuses);
    }

    function _getProposalsAll(uint256 len) internal view returns (string[] memory, string[] memory, string[] memory) {
        string[] memory statuses = new string[](len);
        string[] memory descriptionsArray = new string[](len);
        string[] memory proposalIds = new string[](len);

        uint256 i = len - 1;
        while (i >= 0) {
            uint256 _proposalId = _proposalIds[i];
            proposalIds[i] = _proposalId.toString();
            descriptionsArray[i] = _descriptions[_proposalId];
            statuses[i] = (uint8(state(_proposalId))).toString();

            if (i == 0) {
                break;
            }
            i--;
        }

        return (proposalIds, descriptionsArray, statuses);
    }

    function _getProposals(uint256 _numIndexes, uint256 len) internal view returns (string[] memory, string[] memory, string[] memory) {
        string[] memory statuses = new string[](_numIndexes);
        string[] memory descriptionsArray = new string[](_numIndexes);
        string[] memory proposalIds = new string[](_numIndexes);

        // uint _lb = len - _numIndexes;
        uint256 i = _numIndexes;

        while (i > 0) {
            uint256 _proposalId = _proposalIds[len - 1 - i];
            proposalIds[i - 1] = _proposalId.toString();
            descriptionsArray[i - 1] = _descriptions[_proposalId];
            statuses[i - 1] = (uint8(state(_proposalId))).toString();

            if (i == 0) {
                break;
            }
            i--;
        }

        return (proposalIds, descriptionsArray, statuses);
    }

    function _requireConfirmed(uint256 _proposalId) internal view {
        if (!isConfirmed[_proposalId]) {
            revert ProposalNotConfirmed();
        }
    }

    function _requireNotExpired(uint256 _proposalId) internal view {
        if (_proposals[_proposalId].expireTimestamp < block.timestamp) {
            revert ProposalExpired();
        }
    }

    function _executor() internal view virtual returns (address) {
        return address(this);
    }

    function _quorumReached(uint256 proposalId) internal view virtual returns (bool);

    function _voteSucceeded(uint256 proposalId) internal view virtual returns (bool);

    function _getVotes(address account, uint256 blockNumber, bytes memory params) internal view virtual returns (uint256);

    function _defaultParams() internal view virtual returns (bytes memory) {
        return "";
    }
}
