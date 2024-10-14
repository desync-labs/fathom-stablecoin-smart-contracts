// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import { IFathomCentralizedOracle } from "../interfaces/IFathomCentralizedOracle.sol";
import { IAccessControlConfig } from "../interfaces/IAccessControlConfig.sol";
import { DelayPriceFeedBase } from "./DelayPriceFeedBase.sol";

contract CentralizedOraclePriceFeed is DelayPriceFeedBase {
    IFathomCentralizedOracle public oracle;

    constructor() {
        _disableInitializers();
    }

    function initialize(address _oracle, address _accessControlConfig, bytes32 _poolId) external initializer {
        PausableUpgradeable.__Pausable_init();

        require(_accessControlConfig != address(0), "CentralizedOraclePriceFeed/zero-access-control-config");
        accessControlConfig = IAccessControlConfig(_accessControlConfig);

        require(_oracle != address(0), "CentralizedOraclePriceFeed/zero-access-control-config");
        oracle = IFathomCentralizedOracle(_oracle);
        priceLife = 60 minutes;
        timeDelay = 15 minutes;
        poolId = _poolId;
    }

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "CentralizedOraclePriceFeed/zero-access-control-config");
        oracle = IFathomCentralizedOracle(_oracle);
        this.peekPrice();
    }

    function retrievePrice() external view override returns (PriceInfo memory) {
        (uint256 _price, uint256 _lastUpdate) = oracle.getPrice();
        return PriceInfo(_price, _lastUpdate);
    }
}
