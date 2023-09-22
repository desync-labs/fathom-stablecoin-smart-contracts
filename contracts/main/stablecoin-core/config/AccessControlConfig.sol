// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "../../interfaces/IAccessControlConfig.sol";

contract AccessControlConfig is IAccessControlConfig, AccessControlUpgradeable {
    // solhint-disable var-name-mixedcase
    bytes32 public override immutable OWNER_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public override immutable GOV_ROLE = keccak256("GOV_ROLE");
    bytes32 public override immutable PRICE_ORACLE_ROLE = keccak256("PRICE_ORACLE_ROLE");
    bytes32 public override immutable ADAPTER_ROLE = keccak256("ADAPTER_ROLE");
    bytes32 public override immutable LIQUIDATION_ENGINE_ROLE = keccak256("LIQUIDATION_ENGINE_ROLE");
    bytes32 public override immutable STABILITY_FEE_COLLECTOR_ROLE = keccak256("STABILITY_FEE_COLLECTOR_ROLE");
    bytes32 public override immutable SHOW_STOPPER_ROLE = keccak256("SHOW_STOPPER_ROLE");
    bytes32 public override immutable POSITION_MANAGER_ROLE = keccak256("POSITION_MANAGER_ROLE");
    bytes32 public override immutable MINTABLE_ROLE = keccak256("MINTABLE_ROLE");
    bytes32 public override immutable BOOK_KEEPER_ROLE = keccak256("BOOK_KEEPER_ROLE");
    bytes32 public override immutable COLLATERAL_MANAGER_ROLE = keccak256("COLLATERAL_MANAGER_ROLE");

    // solhint-enable var-name-mixedcase

    function initialize() external initializer {
        AccessControlUpgradeable.__AccessControl_init();

        _setupRole(OWNER_ROLE, msg.sender);
    }


}
