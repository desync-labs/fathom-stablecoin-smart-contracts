// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity 0.8.17;

interface IAdminPausable {
    function adminPause(uint256 flags) external;
}
