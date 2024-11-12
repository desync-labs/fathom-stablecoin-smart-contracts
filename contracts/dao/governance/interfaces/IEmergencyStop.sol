// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022
pragma solidity 0.8.17;

interface IEmergencyStop {
    /**
     * @dev A multisig can stop this contract. Once stopped we will have to migrate.
     *     Once this function is called, the contract cannot be made live again.
     */
    function emergencyStop() external;
}
