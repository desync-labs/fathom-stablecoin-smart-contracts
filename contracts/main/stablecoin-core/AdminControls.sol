// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../interfaces/IAccessControlConfig.sol";
import "../interfaces/ICollateralPoolConfig.sol";
import "../interfaces/IPausable.sol";
import "../interfaces/IBookKeeper.sol";

contract AdminControls is OwnableUpgradeable {
    address public bookKeeper;
    address public liquidationEngine;
    address public priceOracle;
    address public positionManager;
    address public systemDebtEngine;
    address public flashMintModule;
    address public stablecoinAdapter;

    event LogPauseProtocol();
    event LogUnpauseProtocol();

    event LogSetBookKeeper(address indexed newAddress);
    event LogSetPositionManager(address indexed newAddress);
    event LogSetLiquidationEngine(address indexed newAddress);
    event LogSetSystemDebtEngine(address indexed newAddress);
    event LogSetFlashMintModule(address indexed newAddress);
    event LogSetPriceOracle(address indexed newAddress);
    event LogSetStablecoinAdapter(address indexed newAddress);

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    function initialize(
        address _bookKeeper,
        address _liquidationEngine,
        address _priceOracle,
        address _positionManager,
        address _systemDebtEngine,
        address _flashMintModule,
        address _stablecoinAdapter
    ) external initializer {
        OwnableUpgradeable.__Ownable_init();

        require(_bookKeeper != address(0), "AdminControls/zero-book-keeper");
        require(_liquidationEngine != address(0), "AdminControls/zero-liquidation-engine");
        require(_priceOracle != address(0), "AdminControls/zero-price-oracle");
        require(_flashMintModule != address(0), "AdminControls/zero-flash-mint-module");
        require(_systemDebtEngine != address(0), "AdminControls/zero-system-debt-engine");
        require(_stablecoinAdapter != address(0), "AdminControls/zero-stablecoin-adapter");
        require(_positionManager != address(0), "AdminControls/zero-position-manager");

        bookKeeper = _bookKeeper;
        liquidationEngine = _liquidationEngine;
        priceOracle = _priceOracle;
        positionManager = _positionManager;
        flashMintModule = _flashMintModule;
        systemDebtEngine = _systemDebtEngine;
        stablecoinAdapter = _stablecoinAdapter;
    }
    /**
    * @notice Pause all core modules of the protocol.
    * @dev This function can only be called by owner or governance role. All related contracts implementing IPausable interface are paused.
    */
    function pauseProtocol() external onlyOwnerOrGov {
        IPausable(bookKeeper).pause();
        IPausable(positionManager).pause();
        IPausable(liquidationEngine).pause();
        IPausable(systemDebtEngine).pause();
        IPausable(flashMintModule).pause();
        IPausable(priceOracle).pause();
        IPausable(stablecoinAdapter).pause();
        emit LogPauseProtocol();
    }
    /**
    * @notice Unpause all core modules of the protocol.
    * @dev This function can only be called by owner or governance role. All related contracts implementing IPausable interface are unpaused.
    */
    function unpauseProtocol() external onlyOwnerOrGov {
        IPausable(bookKeeper).unpause();
        IPausable(positionManager).unpause();
        IPausable(liquidationEngine).unpause();
        IPausable(systemDebtEngine).unpause();
        IPausable(flashMintModule).unpause();
        IPausable(priceOracle).unpause();
        IPausable(stablecoinAdapter).unpause();
        emit LogUnpauseProtocol();
    }

    function setBookKeeper(address _bookKeeper) external onlyOwnerOrGov {
        require(_bookKeeper != address(0), "AdminControls/zero-address");
        bookKeeper = _bookKeeper;
        emit LogSetBookKeeper(_bookKeeper);
    }

    function setPositionManager(address _positionManager) external onlyOwnerOrGov {
        require(_positionManager != address(0), "AdminControls/zero-address");
        positionManager = _positionManager;
        emit LogSetPositionManager(_positionManager);
    }

    function setLiquidationEngine(address _liquidationEngine) external onlyOwnerOrGov {
        require(_liquidationEngine != address(0), "AdminControls/zero-address");
        liquidationEngine = _liquidationEngine;
        emit LogSetLiquidationEngine(_liquidationEngine);
    }

    function setSystemDebtEngine(address _systemDebtEngine) external onlyOwnerOrGov {
        require(_systemDebtEngine != address(0), "AdminControls/zero-address");
        systemDebtEngine = _systemDebtEngine;
        emit LogSetSystemDebtEngine(_systemDebtEngine);
    }

    function setFlashMintModule(address _flashMintModule) external onlyOwnerOrGov {
        require(_flashMintModule != address(0), "AdminControls/zero-address");
        flashMintModule = _flashMintModule;
        emit LogSetFlashMintModule(_flashMintModule);
    }
 
    function setPriceOracle(address _priceOracle) external onlyOwnerOrGov {
        require(_priceOracle != address(0), "AdminControls/zero-address");
        priceOracle = _priceOracle;
        emit LogSetPriceOracle(_priceOracle);
    }

    function setStablecoinAdapter(address _stablecoinAdapter) external onlyOwnerOrGov {
        require(_stablecoinAdapter != address(0), "AdminControls/zero-address");
        stablecoinAdapter = _stablecoinAdapter;
        emit LogSetStablecoinAdapter(_stablecoinAdapter);
    }
}
