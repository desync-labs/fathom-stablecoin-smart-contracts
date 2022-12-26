// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "./CollateralTokenAdapter.sol";

contract CollateralTokenAdapterFactory {
    mapping(bytes32 => address) private _adapters;

    event CollateralTokenAdapterCreated(bytes32 indexed collateralPoolId, address adapterAddress);

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
    ) external returns (address adapterAddress) {
        try new CollateralTokenAdapter() returns (CollateralTokenAdapter res) {
            adapterAddress = address(res);

            res.initialize(
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
            _adapters[collateralPoolId] = adapterAddress;

            emit CollateralTokenAdapterCreated(collateralPoolId, adapterAddress);
        } catch Error(string memory reason) {
            revert(reason);
        } catch (bytes memory reason) {
            revert(string(reason));
        }
    }

    function getAdapter(bytes32 collateralPoolId) external view returns (address adapterAddress) {
        adapterAddress = _adapters[collateralPoolId];
    }
}
