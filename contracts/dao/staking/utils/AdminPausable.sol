// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity ^0.8.13;

import "./interfaces/IAdminPausable.sol";
import "../../governance/access/AccessControl.sol";

contract AdminPausable is IAdminPausable,AccessControl {
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
    address public admin;
    uint256 public paused;
    bool internal initialized;

    modifier pausable(uint256 flag) {
        require((paused & flag) == 0 || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "paused contract");
        _;
    }

    /// @dev adminPause pauses this contract. Only pause role or default
    /// admin role can access this function.
    /// @param flags flags variable is used for pausing this contract.
    function adminPause(uint256 flags) external override {
        // pause role can pause the contract, however only default admin role can unpause
        require(
            (paused & flags) == paused || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "only admin can unpause"
        );
        paused = flags;
    }

    function pausableInit(uint256 _flags) internal {
        require(!initialized, "already intialized");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSE_ROLE, msg.sender);
        paused = _flags;
        initialized = true;
    }
}
