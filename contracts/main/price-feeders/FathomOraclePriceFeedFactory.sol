// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "./FathomOraclePriceFeed.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

contract FathomOraclePriceFeedFactory is OwnableUpgradeable {
    address public implementation;
    mapping(address => address) public feeds;

    function initialize(address impl) external initializer {
        OwnableUpgradeable.__Ownable_init();
        implementation = impl;
    }

    function createPriceFeed(
        address fathomOracle,
        address token0,
        address token1,
        address accessControlConfig
    ) external onlyOwner {
        FathomOraclePriceFeed feed = FathomOraclePriceFeed(
            Clones.clone(implementation)
        );

        feed.initialize(fathomOracle, token0, token1, accessControlConfig);
        feeds[token1] = address(feed);
    }
}
