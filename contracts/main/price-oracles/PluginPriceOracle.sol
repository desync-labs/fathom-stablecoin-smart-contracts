// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../interfaces/IFathomCentralizedOracle.sol";
import "../interfaces/IAccessControlConfig.sol";
import "../apis/interfaces/IPluginInvokeOracle.sol";

contract PluginPriceOracle is Initializable, IFathomCentralizedOracle {
    uint256 internal constant DECIMALS_CONVERSION_NUM = 1e14;

    IPluginInvokeOracle public oracle;
    IAccessControlConfig public accessControlConfig;

    modifier onlyOwner() {
        require(accessControlConfig.hasRole(accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    function initialize(address _accessControlConfig, address _oracle) external initializer {
        require(_accessControlConfig != address(0), "PluginPriceOracle: ZERO_ADDRESS");
        accessControlConfig = IAccessControlConfig(_accessControlConfig);
        require(IPluginInvokeOracle(_oracle).latestAnswer() > 0, "PluginPriceOracle/invalid-oracle");
        oracle = IPluginInvokeOracle(_oracle);
    }

    function setAccessControlConfig(address _accessControlConfig) external onlyOwner {
        require(
            IAccessControlConfig(_accessControlConfig).hasRole(IAccessControlConfig(_accessControlConfig).OWNER_ROLE(), msg.sender),
            "PluginPriceOracle/msgsender-not-owner"
        );
        accessControlConfig = IAccessControlConfig(_accessControlConfig);
    }

    function setOracle(address _oracle) external onlyOwner {
        require(IPluginInvokeOracle(_oracle).latestAnswer() > 0, "PluginPriceOracle/invalid-oracle");
        oracle = IPluginInvokeOracle(_oracle);
    }

    function getPrice() external view returns (uint256 price, uint256 lastUpdated) {
        price = _toWad(uint256(oracle.latestAnswer()));
        lastUpdated = oracle.latestTimestamp();
    }

    /// price from plugin oracle returns multiplied y 10000 and we want it in wad
    function _toWad(uint256 amount) private pure returns (uint256) {
        return amount * DECIMALS_CONVERSION_NUM;
    }
}
