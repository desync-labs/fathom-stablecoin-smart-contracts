// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "./CollateralTokenAdapter.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";


contract CollateralTokenAdapterFactory is OwnableUpgradeable {
    address public implementationAddress;
    mapping(bytes32 => address) public adapters;

    event CollateralTokenAdapterCreated(
        bytes32 indexed collateralPoolId,
        address adapterAddress
    );

    function initialize(address adapterImplementationAddress) external initializer {
        OwnableUpgradeable.__Ownable_init();
        implementationAddress = adapterImplementationAddress;
    }

    function createAdapter(
        address bookKeeper,
        bytes32 collateralPoolId,
        address collateralToken,
        address rewardToken,
        address fairlaunch,
        uint256 pid,
        address shield,
        address timelock,
        uint256 treasuryFeeBps,
        address treasuryAccount,
        address positionManager
    ) external onlyOwner returns (address adapterAddress) {
        CollateralTokenAdapter adapter = CollateralTokenAdapter(Clones.clone(implementationAddress));

        adapter.initialize(
            bookKeeper,
            collateralPoolId,
            collateralToken,
            rewardToken,
            fairlaunch,
            pid,
            shield,
            timelock,
            treasuryFeeBps,
            treasuryAccount,
            positionManager
        );
        adapters[collateralPoolId] = address(adapter);

        emit CollateralTokenAdapterCreated(
            collateralPoolId,
            adapterAddress
        );
    }
  }