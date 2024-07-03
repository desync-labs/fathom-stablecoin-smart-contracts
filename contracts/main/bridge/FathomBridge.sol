// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./AsterizmClientUpgradeableTransparency.sol";
import "../interfaces/IStablecoinAdapter.sol";
import "../interfaces/IBookKeeper.sol";
import "../interfaces/ICagable.sol";
import "../interfaces/IFathomBridge.sol";
import "../utils/SafeToken.sol";


contract FathomBridge is AsterizmClientUpgradeableTransparency, PausableUpgradeable, IFathomBridge, ICagable {
    using SafeToken for address;
    IBookKeeper public bookKeeper;
    IStablecoinAdapter public stablecoinAdapter;
    uint256 public fixedBridgeFee; // fixed fee [wad]
    uint256 public live; // Active Flag
    bool public isDecentralizedMode;
    mapping(address => bool) public whitelisted;

    event LogAddToWhitelist(address indexed _user);
    event LogRemoveFromWhitelist(address indexed _user);
    event LogSetFee(uint256 _newFee);
    event LogWithdrawFees(address indexed _withdrawer, address indexed _to, uint256 _amount);
    event LogFeeCollection(address indexed _from, uint256 _amount, uint256 _txId);
    event LogSetDecentralizedMode(bool _newValue);
    event LogCrossChainTransferOut(uint64 indexed _dstChainId, address indexed _from, address indexed _to, uint256 _amount, uint256 _txId);
    event LogCrossChainTransferIn(uint64 indexed  _srcChainId, address indexed _from, address indexed _to, uint256 _amount);

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    modifier onlyWhitelisted() {
        if (!whitelisted[msg.sender] && !isDecentralizedMode) {
            revert("FathomBridge/not-whitelisted");
        }
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(IInitializerSender _initializerLib, address _bookKeeper, address _stablecoinAdapter) external initializer {
        _zeroAddressCheck(_bookKeeper);
        _zeroAddressCheck(_stablecoinAdapter);
        _zeroAddressCheck(address(_initializerLib));
        bookKeeper = IBookKeeper(_bookKeeper);
        stablecoinAdapter = IStablecoinAdapter(_stablecoinAdapter);
        live = 1;
        whitelisted[msg.sender] = true;
        _asterizm_initialize(_initializerLib, true, false);
    }

    function addToWhitelist(address _usr) external onlyOwnerOrGov {
        _zeroAddressCheck(_usr);
        whitelisted[_usr] = true;
        emit LogAddToWhitelist(_usr);
    }

    function removeFromWhitelist(address _usr) external onlyOwnerOrGov {
        _zeroAddressCheck(_usr);
        whitelisted[_usr] = false;
        emit LogRemoveFromWhitelist(_usr);
    }

    function setDecentralizedMode(bool _isOn) external onlyOwnerOrGov {
        isDecentralizedMode = _isOn;
        emit LogSetDecentralizedMode(_isOn);
    }

    function setFee(uint256 _newFee) external onlyOwnerOrGov {
        fixedBridgeFee = _newFee;
        emit LogSetFee(_newFee);
    }

    function withdrawFees(address _to) external onlyOwnerOrGov {
        address stablecoin = address(stablecoinAdapter.stablecoin());
        stablecoin.safeTransfer(_to, stablecoin.balanceOf(address(this)));
        emit LogWithdrawFees(msg.sender, _to, stablecoin.balanceOf(address(this)));
    }

    /// Cross-chain transfer
    /// works only when the sender is whitelisted or in decentralized mode
    /// @param _dstChainId uint64  Destination chain ID
    /// @param _to address  To address
    /// @param _amount uint  Amount
    function crossChainTransfer(uint64 _dstChainId, address _to, uint _amount) external onlyWhitelisted nonReentrant{
        require(live == 1, "FathomBridge/not-live");
        require(_amount > fixedBridgeFee, "FathomBridge/amount-less-than-fee");
        _zeroAddressCheck(_to);
        address stablecoin = address(stablecoinAdapter.stablecoin());
        require(stablecoin.balanceOf(msg.sender) >= _amount, "FathomBridge/insufficient-balance");

	    stablecoin.safeTransferFrom(msg.sender, address(this), _amount);
        
        stablecoin.safeApprove(address(stablecoinAdapter), 0);
        uint256 _actualTransferAmount = fixedBridgeFee != 0 ? _amount - fixedBridgeFee : _amount;
        stablecoin.safeApprove(address(stablecoinAdapter), _actualTransferAmount);
        stablecoinAdapter.crossChainTransferOut(msg.sender, _actualTransferAmount);
        stablecoin.safeApprove(address(stablecoinAdapter), 0);
        // bookkeeping
        bookKeeper.handleBridgeOut(_dstChainId, _actualTransferAmount);
        //generate event for off-chain components
        _initAsterizmTransferEvent(_dstChainId, abi.encode(msg.sender, _to, _actualTransferAmount));
        emit LogCrossChainTransferOut(_dstChainId, msg.sender, _to, _actualTransferAmount, _getTxId());
        emit LogFeeCollection(msg.sender, fixedBridgeFee, _getTxId());
    }

    /// Cross-chain fn that triggers when receiving payload from another chain
    /// Minting logic on the receiver side
    function _asterizmReceive(ClAsterizmReceiveRequestDto memory _dto) internal override {
        (address _from, address _to, uint _amount) = abi.decode(_dto.payload, (address, address, uint256));
        stablecoinAdapter.crossChainTransferIn(_to, _amount);
        bookKeeper.handleBridgeIn(_dto.srcChainId, _amount);
        emit LogCrossChainTransferIn(_dto.srcChainId, _from, _to, _amount);
    }

    function _zeroAddressCheck(address _address) internal pure {
        require(_address != address(0), "FathomBridge/zero-address");
    }

    /// @dev The `cage` function permanently halts the `collateralTokenAdapter` contract.
    /// Please exercise caution when using this function as there is no corresponding `uncage` function.
    /// The `cage` function in this contract is unique because it must be called before users can initiate `emergencyWithdraw` in the `collateralTokenAdapter`.
    /// It's a must to invoke this function in the `collateralTokenAdapter` during the final phase of an emergency shutdown.
    function cage() external override nonReentrant onlyOwnerOrGov {
        if (live == 1) {
            live = 0;
            emit LogCage();
        }
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
