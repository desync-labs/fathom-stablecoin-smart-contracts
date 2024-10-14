// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import { IFathomCentralizedOracle } from "../interfaces/IFathomCentralizedOracle.sol";
import { IAccessControlConfig } from "../interfaces/IAccessControlConfig.sol";
import { IFathomOracleAggregator } from "../apis/interfaces/IFathomOracleAggregator.sol";

contract FathomPriceOracle is Initializable, IFathomCentralizedOracle {
    bytes4 private constant ORACLE_INTERFACE_ID = 0x85036ae8; // IAggregator interface id from Fathom Oracle Aggregator

    IFathomOracleAggregator public oracle;
    IAccessControlConfig public accessControlConfig;

    modifier onlyOwner() {
        require(accessControlConfig.hasRole(accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address _accessControlConfig, address _oracle) external initializer {
        require(_accessControlConfig != address(0), "FathomPriceOracle: ZERO_ADDRESS");
        accessControlConfig = IAccessControlConfig(_accessControlConfig);

        require(IFathomOracleAggregator(_oracle).supportsInterface(ORACLE_INTERFACE_ID), "FathomPriceOracle/invalid-oracle");
        oracle = IFathomOracleAggregator(_oracle);
    }

    function setAccessControlConfig(address _accessControlConfig) external onlyOwner {
        require(
            IAccessControlConfig(_accessControlConfig).hasRole(IAccessControlConfig(_accessControlConfig).OWNER_ROLE(), msg.sender),
            "FathomPriceOracle/msgsender-not-owner"
        );
        accessControlConfig = IAccessControlConfig(_accessControlConfig);
        emit LogSetAccessControlConfig(msg.sender, _accessControlConfig);
    }

    function setOracle(address _oracle) external onlyOwner {
        (, uint256 value, , , ) = IFathomOracleAggregator(_oracle).latestRoundData();
        require(value > 0, "FathomPriceOracle/invalid-oracle");
        oracle = IFathomOracleAggregator(_oracle);
    }

    function getPrice() external view returns (uint256 price, uint256 lastUpdated) {
        (, price, lastUpdated, , ) = oracle.latestRoundData();
    }
}
