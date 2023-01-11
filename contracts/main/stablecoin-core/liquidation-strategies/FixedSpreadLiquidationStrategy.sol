// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "../../interfaces/IBookKeeper.sol";
import "../../interfaces/IPriceFeed.sol";
import "../../interfaces/IPriceOracle.sol";
import "../../interfaces/ILiquidationEngine.sol";
import "../../interfaces/ILiquidationStrategy.sol";
import "../../interfaces/ISystemDebtEngine.sol";
import "../../interfaces/IFlashLendingCallee.sol";
import "../../interfaces/IGenericTokenAdapter.sol";
import "../../interfaces/IManager.sol";

import "../../interfaces/IStablecoinAdapter.sol";
import "../../utils/SafeToken.sol";
import "../../../utils/BytesHelper.sol";

contract FixedSpreadLiquidationStrategy is PausableUpgradeable, ReentrancyGuardUpgradeable, ILiquidationStrategy {
    using SafeMathUpgradeable for uint256;
    using SafeToken for address;
    using BytesHelper for *;


    struct LiquidationInfo {
        uint256 positionDebtShare; // [wad]
        uint256 positionCollateralAmount; // [wad]
        uint256 debtShareToBeLiquidated; // [wad]
        uint256 maxDebtShareToBeLiquidated; // [wad]
        uint256 actualDebtValueToBeLiquidated; // [rad]
        uint256 actualDebtShareToBeLiquidated; // [wad]
        uint256 collateralAmountToBeLiquidated; // [wad]
        uint256 treasuryFees; // [wad]
        uint256 maxLiquidatableDebtShare; // [wad]
    }

    struct LocalVars {
        uint256 debtAccumulatedRate; // [ray]
        uint256 closeFactorBps;
        uint256 liquidatorIncentiveBps;
        uint256 debtFloor; // [rad]
        uint256 treasuryFeesBps;
    }

    IBookKeeper public bookKeeper; // Core CDP Engine
    ILiquidationEngine public liquidationEngine; // Liquidation module
    ISystemDebtEngine public systemDebtEngine; // Recipient of FUSD raised in auctions
    IPriceOracle public priceOracle; // Collateral price module
    IStablecoinAdapter public stablecoinAdapter; //StablecoinAdapter to deposit FXD to bookKeeper

    uint256 public flashLendingEnabled;

    event LogFixedSpreadLiquidate(
        bytes32 indexed _collateralPoolId,
        uint256 _positionDebtShare,
        uint256 _positionCollateralAmount,
        address indexed _positionAddress,
        uint256 _debtShareToBeLiquidated,
        uint256 _maxDebtShareToBeLiquidated,
        address indexed _liquidatorAddress,
        address _collateralRecipient,
        uint256 _actualDebtShareToBeLiquidated,
        uint256 _actualDebtValueToBeLiquidated,
        uint256 _collateralAmountToBeLiquidated,
        uint256 _treasuryFees
    );
    event LogSetFlashLendingEnabled(address indexed caller, uint256 _flashLendingEnabled);

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    function initialize(address _bookKeeper, address _priceOracle, address _liquidationEngine, address _systemDebtEngine, address _stablecoinAdapter) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        IBookKeeper(_bookKeeper).totalStablecoinIssued(); // Sanity Check Call
        bookKeeper = IBookKeeper(_bookKeeper);

        IPriceOracle(_priceOracle).stableCoinReferencePrice(); // Sanity Check Call
        priceOracle = IPriceOracle(_priceOracle);

        ILiquidationEngine(_liquidationEngine).live(); // Sanity Check Call
        liquidationEngine = ILiquidationEngine(_liquidationEngine);

        ISystemDebtEngine(_systemDebtEngine).surplusBuffer(); // Sanity Check Call
        systemDebtEngine = ISystemDebtEngine(_systemDebtEngine);

        stablecoinAdapter = IStablecoinAdapter(_stablecoinAdapter); //StablecoinAdapter to deposit FXD to bookKeeper

    }

    uint256 constant BLN = 10 ** 9;
    uint256 constant WAD = 10 ** 18;
    uint256 constant RAY = 10 ** 27;

    function mul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x);
    }

    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y > 0, "FixedSpreadLiquidationStrategy/zero-divisor");
        z = mul(x, RAY) / y;
    }

    function setFlashLendingEnabled(uint256 _flashLendingEnabled) external onlyOwnerOrGov {
        flashLendingEnabled = _flashLendingEnabled;
        emit LogSetFlashLendingEnabled(msg.sender, _flashLendingEnabled);
    }

    function getFeedPrice(bytes32 collateralPoolId) internal returns (uint256 feedPrice) {
        address _priceFeedAddress = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getPriceFeed(collateralPoolId);
        IPriceFeed _priceFeed = IPriceFeed(_priceFeedAddress);
        (bytes32 price, bool priceOk) = _priceFeed.peekPrice();
        require(priceOk, "FixedSpreadLiquidationStrategy/invalid-price");
        // (price [wad] * BLN [10 ** 9] ) [ray] / priceOracle.stableCoinReferencePrice [ray]
        feedPrice = rdiv(mul(uint256(price), BLN), priceOracle.stableCoinReferencePrice()); // [ray]
    }

    function _calculateLiquidationInfo(
        bytes32 _collateralPoolId,
        uint256 _debtShareToBeLiquidated,
        uint256 _currentCollateralPrice,
        uint256 _positionCollateralAmount,
        uint256 _positionDebtShare
    ) internal view returns (LiquidationInfo memory info) {
        LocalVars memory _vars;
        _vars.debtAccumulatedRate = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getDebtAccumulatedRate(_collateralPoolId); // [ray]
        _vars.closeFactorBps = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getCloseFactorBps(_collateralPoolId);
        _vars.liquidatorIncentiveBps = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getLiquidatorIncentiveBps(_collateralPoolId);
        _vars.debtFloor = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getDebtFloor(_collateralPoolId); // [rad]
        _vars.treasuryFeesBps = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getTreasuryFeesBps(_collateralPoolId);

        uint256 _positionDebtValue = _positionDebtShare.mul(_vars.debtAccumulatedRate);

        require(_vars.closeFactorBps > 0, "FixedSpreadLiquidationStrategy/close-factor-bps-not-set");
        info.maxLiquidatableDebtShare = _positionDebtShare.mul(_vars.closeFactorBps).div(10000); // [wad]

        info.actualDebtShareToBeLiquidated = _debtShareToBeLiquidated > info.maxLiquidatableDebtShare
            ? info.maxLiquidatableDebtShare
            : _debtShareToBeLiquidated; // [wad]
        info.actualDebtValueToBeLiquidated = info.actualDebtShareToBeLiquidated.mul(_vars.debtAccumulatedRate); // [rad]

        uint256 _maxCollateralAmountToBeLiquidated = info.actualDebtValueToBeLiquidated.mul(_vars.liquidatorIncentiveBps).div(10000).div(
            _currentCollateralPrice
        ); // [wad]

        if (
            _maxCollateralAmountToBeLiquidated > _positionCollateralAmount ||
            _positionCollateralAmount.sub(_maxCollateralAmountToBeLiquidated).mul(_currentCollateralPrice) <
            _positionDebtValue.sub(info.actualDebtValueToBeLiquidated)
        ) {
            info.collateralAmountToBeLiquidated = _positionCollateralAmount;
            info.actualDebtValueToBeLiquidated = _currentCollateralPrice.mul(_positionCollateralAmount).mul(10000).div(_vars.liquidatorIncentiveBps); // [rad]
        } else {
            if (
                _positionDebtValue > info.actualDebtValueToBeLiquidated &&
                _positionDebtValue.sub(info.actualDebtValueToBeLiquidated) < _vars.debtFloor
            ) {
                info.actualDebtValueToBeLiquidated = _positionDebtValue; // [rad]
                info.collateralAmountToBeLiquidated = info.actualDebtValueToBeLiquidated.mul(_vars.liquidatorIncentiveBps).div(10000).div(
                    _currentCollateralPrice
                ); // [wad]
            } else {
                info.collateralAmountToBeLiquidated = _maxCollateralAmountToBeLiquidated; // [wad]
            }
        }

        info.actualDebtShareToBeLiquidated = info.actualDebtValueToBeLiquidated.div(_vars.debtAccumulatedRate); // [wad]

        // collateralAmountToBeLiquidated - (collateralAmountToBeLiquidated * 10000 / liquidatorIncentiveBps)
        // 1 - (1 * 10000 / 10500) = 0.047619048 which is roughly around 0.05
        uint256 liquidatorIncentiveCollectedFromPosition = info.collateralAmountToBeLiquidated.sub(
            info.collateralAmountToBeLiquidated.mul(10000).div(_vars.liquidatorIncentiveBps)
        ); // [wad]

        // liquidatorIncentiveCollectedFromPosition * (treasuryFeesBps) / 10000
        // 0.047619048 * 5000 / 10000
        info.treasuryFees = liquidatorIncentiveCollectedFromPosition.mul(_vars.treasuryFeesBps).div(10000); // [wad]
    }

    function execute(
        bytes32 _collateralPoolId,
        uint256 _positionDebtShare, // Debt Value                  [rad]
        uint256 _positionCollateralAmount, // Collateral Amount           [wad]
        address _positionAddress, // Address that will receive any leftover collateral
        uint256 _debtShareToBeLiquidated, // The value of debt to be liquidated as specified by the liquidator [rad]
        uint256 _maxDebtShareToBeLiquidated, // The maximum value of debt to be liquidated as specified by the liquidator in case of full liquidation for slippage control [rad]
        address _liquidatorAddress,  //<- liq. engine's address
        address _collateralRecipient,
        bytes calldata _data // Data to pass in external call; if length 0, no call is done
    ) external override nonReentrant whenNotPaused {
        require(
            IAccessControlConfig(bookKeeper.accessControlConfig()).hasRole(keccak256("LIQUIDATION_ENGINE_ROLE"), msg.sender),
            "!liquidationEngingRole"
        );

        require(_positionDebtShare > 0, "FixedSpreadLiquidationStrategy/zero-debt");
        require(_positionCollateralAmount > 0, "FixedSpreadLiquidationStrategy/zero-collateral-amount");
        require(_positionAddress != address(0), "FixedSpreadLiquidationStrategy/zero-position-address");

        uint256 _currentCollateralPrice = getFeedPrice(_collateralPoolId); // [ray]
        require(_currentCollateralPrice > 0, "FixedSpreadLiquidationStrategy/zero-collateral-price");

        LiquidationInfo memory info = _calculateLiquidationInfo(
            _collateralPoolId,
            _debtShareToBeLiquidated,
            _currentCollateralPrice,
            _positionCollateralAmount,
            _positionDebtShare
        );

        require(
            info.actualDebtShareToBeLiquidated <= _maxDebtShareToBeLiquidated,
            "FixedSpreadLiquidationStrategy/exceed-max-debt-value-to-be-liquidated"
        );
        require(
            info.collateralAmountToBeLiquidated < 2 ** 255 && info.actualDebtShareToBeLiquidated < 2 ** 255,
            "FixedSpreadLiquidationStrategy/overflow"
        );
        //2023 Jan 11th, Wed
        //deducting booKeeper.positions[positionADdress] of positionADdress that is being liquidated
        // revert(string(bookKeeper.collateralToken(_collateralPoolId, address(this))._uintToASCIIBytes()));

        //fn below increases bookKeeper.collateralToken(_collateralPoolId, address(this)) balance

        bookKeeper.confiscatePosition(
            _collateralPoolId,
            _positionAddress,
            address(this),
            address(systemDebtEngine),
            -int256(info.collateralAmountToBeLiquidated),
            -int256(info.actualDebtShareToBeLiquidated)
        );
        IGenericTokenAdapter _adapter = IGenericTokenAdapter(ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getAdapter(_collateralPoolId));


                                //accounting on Adapter side
                                //src                 dest
        _adapter.onMoveCollateral(_positionAddress, address(this), info.collateralAmountToBeLiquidated, abi.encode(0));


                                                        // below should be commented out since
                                                        // col balance in bookKeeper for FSL strategy will be
                                                        //deducted as much as withdrawn
                                                        //but where does FSL Strategy have collateral on bookKeeper
                                                        //from the first place..?
                                                        //accounting on bookKeeper
                                                        //src               dest
        

        // revert(string(bookKeeper.collateralToken(_collateralPoolId, address(this))._uintToASCIIBytes()));
        // amazingly, now FSLS has 1000000000000000000 as collateralToken 1WAd.. where did that happen, mystery 


        //bookKeeper accounting #1, comment line below and keep the collateralToken inside bookKeeper to FSLS
        // he can not move this to _collateralRecipient, but just keep it as is.
        // bookKeeper.moveCollateral(_collateralPoolId, address(this), _collateralRecipient, info.collateralAmountToBeLiquidated.sub(info.treasuryFees));


        //Adapter accounting #1, comment line below also keep the stake and certs to FSLS
                                   //src                   dest
        // _adapter.onMoveCollateral(address(this), _collateralRecipient, info.collateralAmountToBeLiquidated.sub(info.treasuryFees), abi.encode(0));


        // 2023 Jan 10th Tue
        // withdraw collateral
        // gives aXDCc straight to liquidator's EOA
        //              2024 Jan 11th Wed
                        //  share of msg.sender decreases and usr(_collateralRecipient) gets aXDCc
                        // who de heck is msg.sender here? it's 
                        // msg.sender in normal .withdraw case.. it was proxyWallet.
                        // then deQuestion is does FixedSpreadLiquidationStrategy has any stake[] in ankrColAdapter

        // _adapter.withdraw(_collateralRecipient, info.collateralAmountToBeLiquidated.sub(info.treasuryFees), abi.encode(0));

        // revert("revert3");

        if (info.treasuryFees > 0) {
            bookKeeper.moveCollateral(_collateralPoolId, address(this), address(systemDebtEngine), info.treasuryFees);
            _adapter.onMoveCollateral(address(this), address(systemDebtEngine), info.treasuryFees, abi.encode(0));
        }
        // revert("revert4");
        _adapter.withdraw(_collateralRecipient, info.collateralAmountToBeLiquidated.sub(info.treasuryFees), abi.encode(0));
        // revert("revert5");
        //get rid of bookKeeper accounting of colToken for FSLS to zero.
        //added at 8:26 PM 2023 Jan 11 Wed
        //burn col amount in bookKeeper and also Stake Value and Certs in Adapter that were before going to colReceiver

        //24 Jan 11 wed 8:34 PM
        //I am commenting this out, but what to do with...remaining colltoken accounting in bookKeeper?
        // bookKeeper.moveCollateral(_collateralPoolId, address(this), address(0), info.collateralAmountToBeLiquidated.sub(info.treasuryFees));
        // revert("revert6");
        // _adapter.onMoveCollateral(address(this), address(0), info.collateralAmountToBeLiquidated.sub(info.treasuryFees), abi.encode(0));



        if (
            flashLendingEnabled == 1 &&
            _data.length > 0 &&
            _collateralRecipient != address(bookKeeper) &&
            _collateralRecipient != address(liquidationEngine)
        ) {
            IFlashLendingCallee(_collateralRecipient).flashLendingCall(
                msg.sender,
                info.actualDebtValueToBeLiquidated,
                info.collateralAmountToBeLiquidated.sub(info.treasuryFees),
                _data
            );
        }
        // 2023 Jan 10th Tue
        // what if I just deposit FXD to BookKeeper using  sth like    function stablecoinAdapterDeposit(
        // like in FathomStablecoinProxyActions.sol, then moveStablecoin will be called?
        // but the amount should be as much as 
        // info.actualDebtValueToBeLiquidated
        // 
        address _stablecoin = address(stablecoinAdapter.stablecoin());
        //2023 Jan 10th.. hm.. safeTransferFrom from colRecipient/liq.bot to this...but...
        //actualDebtValueToBeLiquidated is... in RAD but FXD amount will be in WAD.
        //if I change RAD to WAD there will be some money lost.
        //it means liquidator will pay less than what he actually has to.
        //liquidator's address is no longer really needed but let's leave it for now
                                                                                //RAD to WAD, then add 1
        _stablecoin.safeTransferFrom(_collateralRecipient, address(this), ((info.actualDebtValueToBeLiquidated / RAY) + 1));
        _stablecoin.safeApprove(address(stablecoinAdapter), ((info.actualDebtValueToBeLiquidated / RAY) + 1));
                                                           //RAD to WAD...
        stablecoinAdapter.deposit(_collateralRecipient, ((info.actualDebtValueToBeLiquidated / RAY) + 1), abi.encode(0));
        //from
        // bookKeeper.moveStablecoin(_liquidatorAddress, address(systemDebtEngine), info.actualDebtValueToBeLiquidated);
        // to
        // revert("revertHere1");
        bookKeeper.moveStablecoin(_collateralRecipient, address(systemDebtEngine), info.actualDebtValueToBeLiquidated);
        // revert("revertHere2");

        info.positionDebtShare = _positionDebtShare;
        info.positionCollateralAmount = _positionCollateralAmount;
        info.debtShareToBeLiquidated = _debtShareToBeLiquidated;
        info.maxDebtShareToBeLiquidated = _maxDebtShareToBeLiquidated;
        emit LogFixedSpreadLiquidate(
            _collateralPoolId,
            info.positionDebtShare,
            info.positionCollateralAmount,
            _positionAddress,
            info.debtShareToBeLiquidated,
            info.maxDebtShareToBeLiquidated,
            _liquidatorAddress,
            _collateralRecipient,
            info.actualDebtShareToBeLiquidated,
            info.actualDebtValueToBeLiquidated,
            info.collateralAmountToBeLiquidated,
            info.treasuryFees
        );
    }

    function pause() external onlyOwnerOrGov {
        _pause();
    }

    function unpause() external onlyOwnerOrGov {
        _unpause();
    }
}
