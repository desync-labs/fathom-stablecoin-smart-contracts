// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "./IAdminPausable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract AdminPausable is IAdminPausable, AccessControlUpgradeable {
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
    uint256 public paused;

    modifier pausable(uint256 flag) {
        require((paused & flag) == 0 || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "paused contract");
        _;
    }

    /// @dev adminPause pauses this contract. Only pause role or default
    /// admin role can access this function.
    /// @param flags flags variable is used for pausing this contract.
    function adminPause(uint256 flags) external override onlyRole(PAUSE_ROLE) {
        // pause role can pause the contract, however only default admin role can unpause
        _adminPause(flags);
    }

    function _adminPause(uint256 flags) internal {
        require((paused & flags) == paused || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "only admin can unpause");
        paused = flags;
    }

    function pausableInit(uint256 _flags, address _admin) internal onlyInitializing {
        __AccessControl_init_unchained();
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSE_ROLE, _admin);
        paused = _flags;
    }
}
