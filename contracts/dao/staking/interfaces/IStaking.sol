// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022

pragma solidity ^0.8.13;

import "../StakingStructs.sol";
import "./IStakingGetter.sol";
import "./IStakingHandler.sol";
import "./IStakingStorage.sol";
import "./IStakingSetter.sol";
import "../utils/interfaces/IAdminPausable.sol";

interface IStaking is IStakingGetter, IStakingHandler, IStakingStorage, IStakingSetter, IAdminPausable {}
