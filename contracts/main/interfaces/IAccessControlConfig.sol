// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/IAccessControlUpgradeable.sol";

// solhint-disable func-name-mixedcase
interface IAccessControlConfig is IAccessControlUpgradeable {
    function OWNER_ROLE() external view returns (bytes32);

    function GOV_ROLE() external view returns (bytes32);

    function PRICE_ORACLE_ROLE() external view returns (bytes32);

    function ADAPTER_ROLE() external view returns (bytes32);

    function LIQUIDATION_ENGINE_ROLE() external view returns (bytes32);

    function STABILITY_FEE_COLLECTOR_ROLE() external view returns (bytes32);

    function SHOW_STOPPER_ROLE() external view returns (bytes32);

    function POSITION_MANAGER_ROLE() external view returns (bytes32);

    function MINTABLE_ROLE() external view returns (bytes32);

    function BOOK_KEEPER_ROLE() external view returns (bytes32);

    function COLLATERAL_MANAGER_ROLE() external view returns (bytes32);
}
// solhint-enable func-name-mixedcase
