// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.7.0) (governance/TimelockController.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../../common/access/AccessControl.sol";
import "../../common/Address.sol";
import "./interfaces/ITimelockController.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// solhint-disable not-rely-on-time
contract TimelockController is AccessControl, Initializable, ITimelockController {
    bytes32 public constant TIMELOCK_ADMIN_ROLE = keccak256("TIMELOCK_ADMIN_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");
    uint256 internal constant _DONE_TIMESTAMP = uint256(1);

    mapping(bytes32 => uint256) private _timestamps;
    uint256 private _minDelay;

    event CallScheduled(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data, bytes32 predecessor, uint256 delay);

    event CallExecuted(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data);

    /**
     * @dev Emitted when operation `id` is cancelled.
     */
    event Cancelled(bytes32 indexed id);

    /**
     * @dev Emitted when the minimum delay for future operations is modified.
     */
    event MinDelayChange(uint256 oldDuration, uint256 newDuration);

    event ExecuteTransaction(address indexed owner, bool indexed success, bytes data);

    error ZeroValue();
    error ZeroAddress();
    error LengthMismatch();
    error OperationNotPending();
    error InsufficientValue();
    error FailedToSendEther();
    error NotTimelock();
    error OperationNotReady();
    error OperationAlreadyScheduled();
    error InsufficientDelay();
    error MissingDependency();

    /**
     * @dev Modifier to make a function callable only by a certain role. In
     * addition to checking the sender's role, `address(0)` 's role is also
     * considered. Granting a role to `address(0)` is equivalent to enabling
     * this role for everyone.
     */
    modifier onlyRoleOrOpenRole(bytes32 role) {
        if (!hasRole(role, address(0))) {
            _checkRole(role, _msgSender());
        }
        _;
    }

    // solhint-disable-next-line comprehensive-interface
    receive() external payable {}

    function initialize(uint256 minDelay, address admin, address[] memory proposers, address[] memory executors) public override initializer {
        if (minDelay == 0) {
            revert ZeroValue();
        }
        if (admin == address(0)) {
            revert ZeroAddress();
        }
        _setRoleAdmin(TIMELOCK_ADMIN_ROLE, TIMELOCK_ADMIN_ROLE);
        _setRoleAdmin(PROPOSER_ROLE, TIMELOCK_ADMIN_ROLE);
        _setRoleAdmin(EXECUTOR_ROLE, TIMELOCK_ADMIN_ROLE);
        _setRoleAdmin(CANCELLER_ROLE, TIMELOCK_ADMIN_ROLE);

        _setupRole(TIMELOCK_ADMIN_ROLE, admin);
        _setupRole(TIMELOCK_ADMIN_ROLE, address(this));

        _grantRole(DEFAULT_ADMIN_ROLE, admin);

        for (uint256 i = 0; i < proposers.length; ++i) {
            if (proposers[i] == address(0)) {
                revert ZeroAddress();
            }
            _setupRole(PROPOSER_ROLE, proposers[i]);
            _setupRole(CANCELLER_ROLE, proposers[i]);
        }

        for (uint256 i = 0; i < executors.length; ++i) {
            if (executors[i] == address(0)) {
                revert ZeroAddress();
            }
            _setupRole(EXECUTOR_ROLE, executors[i]);
        }

        _minDelay = minDelay;
        emit MinDelayChange(0, minDelay);
    }

    function schedule(
        address target,
        uint256 value,
        bytes memory data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public virtual override onlyRole(PROPOSER_ROLE) {
        bytes32 id = hashOperation(target, value, data, predecessor, salt);
        _schedule(id, delay);
        emit CallScheduled(id, 0, target, value, data, predecessor, delay);
    }

    function scheduleBatch(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory payloads,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public virtual override onlyRole(PROPOSER_ROLE) {
        if (targets.length != values.length || targets.length != payloads.length) {
            revert LengthMismatch();
        }

        bytes32 id = hashOperationBatch(targets, values, payloads, predecessor, salt);
        _schedule(id, delay);
        for (uint256 i = 0; i < targets.length; ++i) {
            emit CallScheduled(id, i, targets[i], values[i], payloads[i], predecessor, delay);
        }
    }

    function cancel(bytes32 id) public virtual override onlyRole(CANCELLER_ROLE) {
        if (!isOperationPending(id)) {
            revert OperationNotPending();
        }
        delete _timestamps[id];

        emit Cancelled(id);
    }

    function execute(
        address target,
        uint256 value,
        bytes memory payload,
        bytes32 predecessor,
        bytes32 salt
    ) public payable virtual override onlyRoleOrOpenRole(EXECUTOR_ROLE) {
        bytes32 id = hashOperation(target, value, payload, predecessor, salt);
        if (msg.value < value) {
            revert InsufficientValue();
        }
        _beforeCall(id, predecessor);
        _execute(target, value, payload);
        emit CallExecuted(id, 0, target, value, payload);
        _afterCall(id);
        if (msg.value > value) {
            (bool sent, ) = msg.sender.call{ value: (msg.value - value) }("");
            if (!sent) {
                revert FailedToSendEther();
            }
        }
    }

    function executeBatch(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory payloads,
        bytes32 predecessor,
        bytes32 salt
    ) public payable virtual override onlyRoleOrOpenRole(EXECUTOR_ROLE) {
        if (targets.length != values.length || targets.length != payloads.length) {
            revert LengthMismatch();
        }

        bytes32 id = hashOperationBatch(targets, values, payloads, predecessor, salt);
        uint256 totalValue;
        _beforeCall(id, predecessor);
        for (uint256 i = 0; i < targets.length; ++i) {
            address target = targets[i];
            uint256 value = values[i];
            totalValue += value;
            bytes memory payload = payloads[i];
            _execute(target, value, payload);
            emit CallExecuted(id, i, target, value, payload);
        }
        _afterCall(id);
        if (msg.value < totalValue) {
            revert InsufficientValue();
        }
        if (msg.value > totalValue) {
            (bool sent, ) = msg.sender.call{ value: (msg.value - totalValue) }("");
            if (!sent) {
                revert FailedToSendEther();
            }
        }
    }

    function updateDelay(uint256 newDelay) public virtual override {
        if (msg.sender != address(this)) {
            revert NotTimelock();
        }
        if (newDelay == 0) {
            revert ZeroValue();
        }
        emit MinDelayChange(_minDelay, newDelay);
        _minDelay = newDelay;
    }

    function grantRoleByAdmin(bytes32 role, address account) public override onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
    }

    function revokeRoleByAdmin(bytes32 role, address account) public override onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(role, account);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function isOperation(bytes32 id) public view virtual override returns (bool registered) {
        return getTimestamp(id) > 0;
    }

    function isOperationPending(bytes32 id) public view virtual override returns (bool pending) {
        return getTimestamp(id) > _DONE_TIMESTAMP;
    }

    function isOperationReady(bytes32 id) public view virtual override returns (bool ready) {
        uint256 timestamp = getTimestamp(id);
        return timestamp > _DONE_TIMESTAMP && timestamp <= block.timestamp;
    }

    function isOperationDone(bytes32 id) public view virtual override returns (bool done) {
        return getTimestamp(id) == _DONE_TIMESTAMP;
    }

    function getTimestamp(bytes32 id) public view virtual override returns (uint256 timestamp) {
        return _timestamps[id];
    }

    function getMinDelay() public view virtual override returns (uint256 duration) {
        return _minDelay;
    }

    function hashOperation(
        address target,
        uint256 value,
        bytes memory data,
        bytes32 predecessor,
        bytes32 salt
    ) public pure virtual override returns (bytes32 hash) {
        return keccak256(abi.encode(target, value, data, predecessor, salt));
    }

    function hashOperationBatch(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory payloads,
        bytes32 predecessor,
        bytes32 salt
    ) public pure virtual override returns (bytes32 hash) {
        return keccak256(abi.encode(targets, values, payloads, predecessor, salt));
    }

    function _execute(address target, uint256 value, bytes memory data) internal virtual {
        (bool success, ) = target.call{ value: value }(data);
        emit ExecuteTransaction(msg.sender, success, data);
    }

    function _afterCall(bytes32 id) private {
        if (!isOperationReady(id)) {
            revert OperationNotReady();
        }
        _timestamps[id] = _DONE_TIMESTAMP;
    }

    function _schedule(bytes32 id, uint256 delay) private {
        if (isOperation(id)) {
            revert OperationAlreadyScheduled();
        }
        if (delay < getMinDelay()) {
            revert InsufficientDelay();
        }
        _timestamps[id] = block.timestamp + delay;
    }

    function _beforeCall(bytes32 id, bytes32 predecessor) private view {
        if (!isOperationPending(id)) {
            revert OperationNotPending();
        }
        if (predecessor != bytes32(0) && !isOperationDone(predecessor)) {
            revert MissingDependency();
        }
    }
}
