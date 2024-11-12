// SPDX-License-Identifier: MIT
// Copyright Fathom 2022

pragma solidity 0.8.17;

interface ITimelockController {
    function initialize(uint256 minDelay, address admin, address[] calldata proposers, address[] calldata executors) external;

    function schedule(address target, uint256 value, bytes calldata data, bytes32 predecessor, bytes32 salt, uint256 delay) external;

    function scheduleBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) external;

    function cancel(bytes32 id) external;

    function execute(address target, uint256 value, bytes calldata payload, bytes32 predecessor, bytes32 salt) external payable;

    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt
    ) external payable;

    function updateDelay(uint256 newDelay) external;

    function grantRoleByAdmin(bytes32 role, address account) external;

    function revokeRoleByAdmin(bytes32 role, address account) external;

    function isOperation(bytes32 id) external view returns (bool registered);

    function isOperationPending(bytes32 id) external view returns (bool pending);

    function isOperationReady(bytes32 id) external view returns (bool ready);

    function isOperationDone(bytes32 id) external view returns (bool done);

    function getTimestamp(bytes32 id) external view returns (uint256 timestamp);

    function getMinDelay() external view returns (uint256 duration);

    function hashOperation(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt
    ) external pure returns (bytes32 hash);

    function hashOperationBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt
    ) external pure returns (bytes32 hash);
}
