// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/IPriceFeed.sol";
import "../interfaces/IFathomCentralizedOracle.sol";
import "../interfaces/IAccessControlConfig.sol";

contract CentralizedOraclePriceFeed is PausableUpgradeable, IPriceFeed {
    uint256 public lastPrice;
    uint256 public lastUpdateTS;
    uint256 public priceLife;
    bytes32 public poolId;

    IFathomCentralizedOracle public fathomOracle;
    IAccessControlConfig public accessControlConfig;
    
    event LogSetPriceLife(address indexed _caller, uint256 _second);

    modifier onlyOwner() {
        require(accessControlConfig.hasRole(accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    modifier onlyOwnerOrGov() {
        require(
            accessControlConfig.hasRole(accessControlConfig.OWNER_ROLE(), msg.sender) ||
                accessControlConfig.hasRole(accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    function initialize(address _fathomOracle, address _accessControlConfig, bytes32 _poolId) external initializer {
        PausableUpgradeable.__Pausable_init();

        require(_accessControlConfig != address(0), "CentralizedOraclePriceFeed: ZERO_ADDRESS");
        accessControlConfig = IAccessControlConfig(_accessControlConfig);

        fathomOracle = IFathomCentralizedOracle(_fathomOracle);
        priceLife = 30 minutes;
        poolId = _poolId;
    }

    function setAccessControlConfig(address _accessControlConfig) external onlyOwner {
        require(IAccessControlConfig(_accessControlConfig).hasRole(IAccessControlConfig(_accessControlConfig).OWNER_ROLE(), msg.sender), "CentralizedOraclePriceFeed/msgsender-not-owner");
        accessControlConfig = IAccessControlConfig(_accessControlConfig);
    }

    function setPriceLife(uint256 _second) external onlyOwner {
        require(_second >= 5 minutes && _second <= 1 days, "CentralizedOraclePriceFeed/bad-price-life");
        priceLife = _second;
        this.peekPrice();
        emit LogSetPriceLife(msg.sender, _second);
    }

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "CentralizedOraclePriceFeed: ZERO_ADDRESS");
        fathomOracle = IFathomCentralizedOracle(_oracle);
        this.peekPrice();
    }
    
    function setPoolId(bytes32 _poolId) external onlyOwner {
       poolId = _poolId;
    }

    function peekPrice() external override returns (uint256, bool) {
        (uint256 _price, uint256 _lastUpdate) = fathomOracle.getPrice();
        
        require(_price > 0, "CentralizedOraclePriceFeed/wrong-price");
        require(_lastUpdate <= block.timestamp, "CentralizedOraclePriceFeed/wrong-lastUpdate");

        lastPrice = _price;
        lastUpdateTS = _lastUpdate;
        return (lastPrice, _isPriceOk());
    }

    function pause() external onlyOwnerOrGov {
        _pause();
    }

    function unpause() external onlyOwnerOrGov {
        _unpause();
        this.peekPrice();
    }

    function readPrice() external view override returns (uint256) {
        return lastPrice;
    }

    function isPriceOk() external view override returns (bool) {
        return _isPriceOk();
    }

    function _isPriceFresh() internal view returns (bool) {
        return lastUpdateTS >= block.timestamp - priceLife;
    }

    function _isPriceOk() internal view returns (bool) {
        return _isPriceFresh() && !paused();
    }
}
