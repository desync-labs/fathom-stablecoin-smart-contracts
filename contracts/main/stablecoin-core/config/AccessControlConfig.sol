// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "../../interfaces/IAccessControlConfig.sol";

contract AccessControlConfig is IAccessControlConfig, AccessControlUpgradeable {
    // solhint-disable var-name-mixedcase
    bytes32 public immutable override OWNER_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public immutable override GOV_ROLE = keccak256("GOV_ROLE");
    bytes32 public immutable override PRICE_ORACLE_ROLE = keccak256("PRICE_ORACLE_ROLE");
    bytes32 public immutable override ADAPTER_ROLE = keccak256("ADAPTER_ROLE");
    bytes32 public immutable override LIQUIDATION_ENGINE_ROLE = keccak256("LIQUIDATION_ENGINE_ROLE");
    bytes32 public immutable override STABILITY_FEE_COLLECTOR_ROLE = keccak256("STABILITY_FEE_COLLECTOR_ROLE");
    bytes32 public immutable override SHOW_STOPPER_ROLE = keccak256("SHOW_STOPPER_ROLE");
    bytes32 public immutable override POSITION_MANAGER_ROLE = keccak256("POSITION_MANAGER_ROLE");
    bytes32 public immutable override MINTABLE_ROLE = keccak256("MINTABLE_ROLE");
    bytes32 public immutable override BOOK_KEEPER_ROLE = keccak256("BOOK_KEEPER_ROLE");
    bytes32 public immutable override COLLATERAL_MANAGER_ROLE = keccak256("COLLATERAL_MANAGER_ROLE");

    // solhint-enable var-name-mixedcase

    function initialize() external initializer {
        AccessControlUpgradeable.__AccessControl_init();

        _setupRole(OWNER_ROLE, msg.sender);
    }
}
