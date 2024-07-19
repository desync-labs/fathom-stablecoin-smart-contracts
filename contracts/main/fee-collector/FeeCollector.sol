pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/IBookKeeper.sol";
import "../interfaces/ISystemDebtEngine.sol";
import "../interfaces/ICollateralTokenAdapter.sol";
import "../interfaces/IFlashMintModule.sol";
import "../interfaces/IStablecoinAdapter.sol";
import "../interfaces/IFathomBridge.sol";
import "../utils/SafeToken.sol";
//TODO, first make the smart contract, then make the interface
//TODO, make another role for fee collection; fee collection related functions should be accessible by this role, need to think whether owner would be allowed or not
//TODO, later spread the functions apart to each small section. Setter, Getter, etc. after finishing all the functions and the make this contract inherit them
contract FathomPriceOracle is PausableUpgradeable {
    using SafeToken for address;
    IBookKeeper public bookKeeper;
    ICollateralPoolConfig public collateralPoolConfig;
    ISystemDebtEngine public systemDebtEngine;
    IFlashMintModule public flashMintModule;
    IStablecoinAdapter public stablecoinAdapter;
    IFathomBridge public fathomBridge;
    bytes32[] public collateralPoolIds;

    event LogSetFathomBridge(address indexed _setter, address indexed _fathomBridge);
    event LogSetStablecoinAdapter(address indexed _setter, address indexed _stablecoinAdapter);
    event LogSetFlashMintModule(address indexed _setter, address indexed _flashMintModule);
    event LogSetSystemDebtEngine(address indexed _setter, address indexed _systemDebtEngine);
    event LogSetBookKeeper(address indexed _setter, address indexed _bookKeeper);
    event LogAddCollateralPoolId(address indexed _setter, bytes32 indexed _collateralPoolId);
    event LogRemoveCollateralPoolId(address indexed _setter, bytes32 indexed _collateralPoolId);

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!(ownerRole)");
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _bookKeeper,
        address _collateralPoolConfig,
        address _systemDebtEngine,
        address _flashMintModule,
        address _stablecoinAdapter,
        bytes32[] calldata _collateralPoolIds,
    ) external initializer {
        _zeroAddressCheck(_bookKeeper);
        _zeroAddressCheck(_systemDebtEngine);
        _zeroAddressCheck(_flashMintModule);
        _zeroAddressCheck(_stablecoinAdapter);
        require(_collateralPoolIds.length > 0, "FathomPriceOracle/empty-collateralPoolIds");
        bookKeeper = IBookKeeper(_bookKeeper);
        collateralPoolConfig = ICollateralPoolConfig(_collateralPoolConfig);
        systemDebtEngine = ISystemDebtEngine(_systemDebtEngine);
        flashMintModule = IFlashMintModule(_flashMintModule);
        stablecoinAdapter = IStablecoinAdapter(_stablecoinAdapter);
        collateralPoolIds = _collateralPoolIds;
    }

    function setFathomBridge(address _fathomBridge) external onlyOwner {
        _zeroAddressCheck(_fathomBridge);
        fathomBridge = IFathomBridge(_fathomBridge);
        emit LogSetFathomBridge(msg.sender, _fathomBridge);
    }

    function setStablecoinAdapter(address _stablecoinAdapter) external onlyOwner {
        _zeroAddressCheck(_stablecoinAdapter);
        stablecoinAdapter = IStablecoinAdapter(_stablecoinAdapter);
        emit LogSetStablecoinAdapter(msg.sender, _stablecoinAdapter);
    }

    function setFlashMintModule(address _flashMintModule) external onlyOwner {
        _zeroAddressCheck(_flashMintModule);
        flashMintModule = IFlashMintModule(_flashMintModule);
        emit LogSetFlashMintModule(msg.sender, _flashMintModule);
    }

    function setSystemDebtEngine(address _systemDebtEngine) external onlyOwner {
        _zeroAddressCheck(_systemDebtEngine);
        systemDebtEngine = ISystemDebtEngine(_systemDebtEngine);
        emit LogSetSystemDebtEngine(msg.sender, _systemDebtEngine);
    }

    function setBookKeeper(address _bookKeeper) external onlyOwner {
        _zeroAddressCheck(_bookKeeper);
        bookKeeper = IBookKeeper(_bookKeeper);
        emit LogSetBookKeeper(msg.sender, _bookKeeper);
    }

    function addCollateralPoolId(bytes32 _collateralPoolId) external onlyOwner {
        require(_collateralPoolId != bytes32(0), "FathomPriceOracle/zero-collateralPoolId");
        collateralPoolIds.push(_collateralPoolId);
        emit LogAddCollateralPoolId(msg.sender, _collateralPoolId);
    }

    function removeCollateralPoolId(uint256 index) external onlyOwner {
        bytes32 _removedCollateralPoolId = collateralPoolIds[index];
        _removeBySwapping(index);
        emit LogRemoveCollateralPoolId(msg.sender, _removedCollateralPoolId);
    }

    function checkCollateralSurplus(bytes32 _collateralPoolId) external view returns (uint256) {
        return _checkCollateralSurplus(_collateralPoolId);
    }

    function withdrawCollateralSurplus(bytes32 _collateralPoolId, address _to, uint256 _amount) external onlyOwner {
        _withdrawCollateralSurplus(_collateralPoolId, _to, _amount);
    }

    function withdrawCollateral(address _collateralPoolId, address _to, uint256 _amount) external onlyOwner {
        _withdrawCollateral(_collateralPoolId, _to, _amount);
    }

    function _withdrawCollateral(bytes32 _collateralPoolId, address _to, uint256 _amount) internal {
        ICollateralTokenAdapter _collateralTokenAdapter = ICollateralTokenAdapter(collateralPoolConfig.getAdapter(_collateralPoolId));
        _collateralTokenAdapter.withdraw(_to, _amount, 0x00);
    }

    function _withdrawCollateralSurplus(bytes32 _collateralPoolId, address _to, uint256 _amount) internal {
        systemDebtEngine.withdrawCollateralSurplus(_collateralPoolId, _to, _amount);
    }

    function _checkCollateralSurplus(bytes32 _collateralPoolId) internal returns (uint256){
        uint256 _collateralSurplus = bookKeeper.collateralToken(_collateralPoolId, address(systemDebtEngine));
        return _collateralSurplus;
    }

    function _removeBySwapping(uint256 index) internal {
        require(index < collateralPoolIds.length, "Index out of bounds");
        collateralPoolIds[index] = collateralPoolIds[collateralPoolIds.length - 1];
        collateralPoolIds.pop();
    }

    function _zeroAddressCheck(address _address) internal pure {
        require(_address != address(0), "FeeCollector/zero-address");
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function pause() external onlyOwnerOrGov {
        _pause();
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function unpause() external onlyOwnerOrGov {
        _unpause();
    }
}
