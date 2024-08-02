// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/IBookKeeper.sol";
import "../interfaces/ISystemDebtEngine.sol";
import "../interfaces/ICollateralAdapter.sol";
import "../interfaces/IFlashMintModule.sol";
import "../interfaces/IStablecoinAdapter.sol";
import "../interfaces/IFathomBridge.sol";
import "../utils/SafeToken.sol";
//TODO, first make the smart contract, then make the interface
//TODO, Ideally if all the fee related activities have same role protected modifier it would be nice, but not all are the same. Possibly add another role
//TODO, later spread the functions apart to each small section. Setter, Getter, etc. after finishing all the functions and the make this contract inherit them
//TODO, places to withdraw fees, flashMintModule, fathomBridge, systemDebtEngine(collateralSurplus/stablecoinSurplus)
//TODO, for fathomBridge, it's withdrawing actual amount of FXD
//TODo, for flashMintModule, it seems like convert() and accrue() only matters
//TODo, systemDebtengine, it's withdrawing collateral or stablecoin surplus
//TODO, Maybe Don't make a loop of collateral in this smart contract, just make the EOA that has fee_collector_role to call the function to withdraw collateral
contract FeeCollector is PausableUpgradeable {
    using SafeToken for address;
    address public stablecoin;
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


    //TODO both EOA that calls fn in this smart contract and this contract should be given role fee_collector_role
    //TODO accessControlConfig smart contract should be added with fee_collector_role
    modifier onlyFeeCollector {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.FEE_COLLECTOR_ROLE(), msg.sender), "!(feeCollectorRole)");
        _;
    }

    // TODO functions in other smart contracts that is protected by onlyOwner should be changed to onlyOwnerOrFeeCollector

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _bookKeeper,
        address _collateralPoolConfig,
        address _systemDebtEngine,
        address _flashMintModule,
        address _stablecoinAdapter

    ) external initializer {
        _zeroAddressCheck(_bookKeeper);
        _zeroAddressCheck(_systemDebtEngine);
        _zeroAddressCheck(_flashMintModule);
        _zeroAddressCheck(_stablecoinAdapter);
        bookKeeper = IBookKeeper(_bookKeeper);
        collateralPoolConfig = ICollateralPoolConfig(_collateralPoolConfig);
        systemDebtEngine = ISystemDebtEngine(_systemDebtEngine);
        flashMintModule = IFlashMintModule(_flashMintModule);
        stablecoinAdapter = IStablecoinAdapter(_stablecoinAdapter);
        stablecoin = address(stablecoinAdapter.stablecoin());
    }

    function addCollateralPoolId(bytes32 _collateralPoolId) external onlyFeeCollector {
        require(_collateralPoolId != bytes32(0), "FathomPriceOracle/zero-collateralPoolId");
        collateralPoolIds.push(_collateralPoolId);
        emit LogAddCollateralPoolId(msg.sender, _collateralPoolId);
    }

    function removeCollateralPoolId(uint256 index) external onlyFeeCollector {
        bytes32 _removedCollateralPoolId = collateralPoolIds[index];
        _removeBySwapping(index);
        emit LogRemoveCollateralPoolId(msg.sender, _removedCollateralPoolId);
}

    function setCollateralPoolConfig(address _collateralPoolConfig) external onlyFeeCollector {
        _zeroAddressCheck(_collateralPoolConfig);
        collateralPoolConfig = ICollateralPoolConfig(_collateralPoolConfig);
    }

    function setFathomBridge(address _fathomBridge) external onlyFeeCollector {
        _zeroAddressCheck(_fathomBridge);
        fathomBridge = IFathomBridge(_fathomBridge);
        emit LogSetFathomBridge(msg.sender, _fathomBridge);
    }

    function setStablecoinAdapter(address _stablecoinAdapter) external onlyFeeCollector {
        _zeroAddressCheck(_stablecoinAdapter);
        stablecoinAdapter = IStablecoinAdapter(_stablecoinAdapter);
        emit LogSetStablecoinAdapter(msg.sender, _stablecoinAdapter);
    }

    function setFlashMintModule(address _flashMintModule) external onlyFeeCollector {
        _zeroAddressCheck(_flashMintModule);
        flashMintModule = IFlashMintModule(_flashMintModule);
        emit LogSetFlashMintModule(msg.sender, _flashMintModule);
    }

    function setSystemDebtEngine(address _systemDebtEngine) external onlyFeeCollector {
        _zeroAddressCheck(_systemDebtEngine);
        systemDebtEngine = ISystemDebtEngine(_systemDebtEngine);
        emit LogSetSystemDebtEngine(msg.sender, _systemDebtEngine);
    }

    function setBookKeeper(address _bookKeeper) external onlyFeeCollector {
        _zeroAddressCheck(_bookKeeper);
        bookKeeper = IBookKeeper(_bookKeeper);
        emit LogSetBookKeeper(msg.sender, _bookKeeper);
    }


    function checkCollateralSurplus(bytes32 _collateralPoolId) external view returns (uint256) {
        return _checkCollateralSurplus(_collateralPoolId);
    }

    function withdrawCollateralSurplus(bytes32 _collateralPoolId, address _to, uint256 _amount) external onlyFeeCollector {
        _withdrawCollateralSurplus(_collateralPoolId, _to, _amount);
    }

    function withdrawFathomBridgeFee(address _to) external onlyFeeCollector {
        _withdrawFathomBridgeFee(_to);
    }

    //systemDebtEngine


    //collateralWithdrawal
    //collateralSurplusWithdrawal to this address
    //first check if the collateralPoolId is in the collateralPoolIds
    //and then withdraw collateral from collateralTokenAdapter
    //Let's make a loop version and a non-loop version
    //add a require statment that checks whether this contract is whitelisted in the collateralTokenAdapter

    //Looping version
    function withdrawAllCollaterals(address _to) external onlyFeeCollector {
        _withdrawAllCollaterals(_to);
    }

    function withdrawAllCollateralsToThisContract() external onlyFeeCollector {
        _withdrawAllCollaterals(address(this));
    }

    function _withdrawAllCollaterals(address _to) internal {
        for (uint256 i = 0; i < collateralPoolIds.length; i++) {
            _withdrawCollateral(collateralPoolIds[i], _to);
        }
    }

    function _withdrawCollateral(bytes32 _collateralPoolId, address _to) internal {
        uint256 _collateralSurplus = _checkCollateralSurplus(_collateralPoolId);
        if (_collateralSurplus > 0) {
            _withdrawCollateralSurplus(_collateralPoolId, address(this), _collateralSurplus);
        }
        uint256 _collateralTokenBalance = bookKeeper.collateralToken(_collateralPoolId, address(this));
        if (_collateralTokenBalance > 0) {
            _withdrawCollateralFromAdapter(_collateralPoolId, _to, _collateralTokenBalance);
        } else {
            revert("FeeCollector/no-collateral-to-withdraw");
        }
    }

    //Non-looping version
    function withdrawlCollateral(bytes32 _collateralPoolId, address _to) external onlyFeeCollector {
        _withdrawCollateral(_collateralPoolId, _to);
    }

    function withdrawCollateralToThisContract(bytes32 _collateralPoolId) external onlyFeeCollector {
        _withdrawCollateral(_collateralPoolId, address(this));
    }

    function _withdrawCollateralFromAdapter(bytes32 _collateralPoolId, address _to, uint256 _amount) internal {
        ICollateralAdapter _collateralTokenAdapter = ICollateralAdapter(collateralPoolConfig.getAdapter(_collateralPoolId));
        require(_collateralPoolId == _collateralTokenAdapter.collateralPoolId(), "FeeCollector/collateralPoolId-mismatch");
        require(_collateralTokenAdapter.whiteListed(address(this)), "FeeCollector/not-whitelisted");
        _collateralTokenAdapter.withdraw(_to, _amount, new bytes(0));
    }

    //function that can withdraw token from this address to another address
    function withdraw(address _token, address _to) external onlyFeeCollector {
        _token.safeTransfer(_to, _token.balanceOf(address(this)));
    }

    //atomic withdraw
    //convert if there is any stablecoin balance for flashMintModule
    // and accrue if there is any bookKeeper.stablecoin balance for FlashMintModule
    //then do the stablecoin surplus withdrawal
    function withdrawStablecoinSurplus(address _to) external onlyFeeCollector {
        convertAndAccrue();
        _withdrawStablecoinSurplus(_to);
    }

    function _withdrawStablecoinSurplus(address _to) internal {
        uint256 systemBadDebt = bookKeeper.systemBadDebt(address(systemDebtEngine));
        uint256 initialStablecoinSurplus = bookKeeper.stablecoin(address(systemDebtEngine));

        if (initialStablecoinSurplus >= systemBadDebt) {
            systemDebtEngine.settleSystemBadDebt(systemBadDebt);
        } else {
            revert ("FeeCollector/insufficient-stablecoin-surplus");
        }

        uint256 stablecoinSurplus = bookKeeper.stablecoin(address(systemDebtEngine));
        uint256 surplusBuffer = systemDebtEngine.surplusBuffer();

        if (stablecoinSurplus > surplusBuffer) {
            systemDebtEngine.withdrawStablecoinSurplus(address(this), surplusBuffer);
            stablecoinAdapter.withdraw(_to, surplusBuffer, new bytes(0));
        } else {
            revert("FeeCollector/stablecoinSurplus-less-than-surplusBuffer");
        }
    }

    function convertAndAccrue() public onlyFeeCollector {
        if (stablecoin.balanceOf(address(flashMintModule)) > 0) {
            _convert();
        }
        _accrue();
    }

    function accrue() external onlyFeeCollector {
        _accrue();
    }

    //this function moves bookKeeper stablecoin balance from flashMintModule to systemDebtEngine
    function _accrue() internal {
        require(bookKeeper.stablecoin(address(flashMintModule)) > 0, "FeeCollector/no-bookKeeperStablecoin-balance");
        flashMintModule.accrue();
    }

    function convert() external onlyFeeCollector {
        _convert();
    }
    //this function moves stablecoin balance of FlashMintModule to bookKeeper stablecoin balance
    function _convert() internal {
        //the stablecion balance of flashMintModule should be more than 0
        require(stablecoin.balanceOf(address(flashMintModule)) > 0, "FeeCollector/no-stablecoin-balance");        
        flashMintModule.convert();
    }

    //TODO later the fathomBridge implementaiton should be upgraded so that the modifier would be onlyOwnerOrFeeCollector
    //At the moment(2024-08-02) fathomBridge's withdraw() function is protected by onlyOwnerOrGov
    function _withdrawFathomBridgeFee(address _to) internal {
        require(fathomBridge != IFathomBridge(address(0)), "FeeCollector/FathomBridge-zero-address");
        require(_to != address(0), "FeeCollector/FathomBridge-zero-address");
        require(fathomBridge.fixedBridgeFee() > 0, "FeeCollector/FathomBridge-no-fee-set");
        require(stablecoin.balanceOf(address(fathomBridge)) > 0, "FeeCollector/FathomBridge-no-fee-balance");
        fathomBridge.withdrawFees(_to);
    }

    function _withdrawCollateralSurplus(bytes32 _collateralPoolId, address _to, uint256 _amount) internal {
        systemDebtEngine.withdrawCollateralSurplus(_collateralPoolId, _to, _amount);
    }

    function _checkCollateralSurplus(bytes32 _collateralPoolId) internal view returns (uint256){
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

    function pause() external onlyFeeCollector {
        _pause();
    }

    function unpause() external onlyFeeCollector {
        _unpause();
    }
}
