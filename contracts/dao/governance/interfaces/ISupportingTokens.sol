// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022
pragma solidity 0.8.17;

interface ISupportingTokens {
    /**
     * @dev Adds supporting tokens so that if there are tokens then it can be transferred
     *     Only Governance is able to access this function.
     *     It has to go through proposal and successful voting for execution.
     */
    function addSupportingToken(address _token) external;

    /**
     * @dev Removes supporting tokens
     *      Only Governance is able to access this function.
     *      It has to go through proposal and successful voting for execution.
     */
    function removeSupportingToken(address _token) external;
}
