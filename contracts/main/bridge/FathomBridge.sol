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

    uint256 public live; // Active Flag
    bool public isDecentralizedMode;
    mapping(address => bool) public whitelisted;

    event LogAddToWhitelist(address indexed _user);
    event LogRemoveFromWhitelist(address indexed _user);
    event LogSetDecentralizedMode(bool _newValue);
    event logCrossChainTransferOut(uint64 indexed _dstChainId, address indexed _from, address indexed _to, uint _amount);
    event logCrossChainTransferIn(uint64 indexed  _srcChainId, address indexed _from, address indexed _to, uint _amount);

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

    function initialize(IInitializerSender _initializerLib, bool _notifyTransferSendingResult, bool _disableHashValidation, address _bookKeeper, address _stablecoinAdapter) external initializer {
        _zeroAddressCheck(_bookKeeper);
        _zeroAddressCheck(_stablecoinAdapter);
        _zeroAddressCheck(address(_initializerLib));
        bookKeeper = IBookKeeper(_bookKeeper);
        stablecoinAdapter = IStablecoinAdapter(_stablecoinAdapter);
        _asterizm_initialize(_initializerLib, _notifyTransferSendingResult, _disableHashValidation);
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

    /// Cross-chain transfer
    /// works only when the sender is whitelisted or in decentralized mode
    /// @param _dstChainId uint64  Destination chain ID
    /// @param _to address  To address
    /// @param _amount uint  Amount
    function crossChainTransfer(uint64 _dstChainId, address _to, uint _amount) external onlyWhitelisted {
        require(live == 1, "FathomBridge/not-live");
        require(_amount > 0, "FathomBridge/zero-amount");
        _zeroAddressCheck(_to);
        address stablecoin = address(stablecoinAdapter.stablecoin());
        require(stablecoin.balanceOf(msg.sender) >= _amount, "FathomBridge/insufficient-balance");

	    stablecoin.safeTransferFrom(msg.sender, address(this), _amount);
        stablecoin.safeApprove(address(stablecoinAdapter), 0);
        stablecoin.safeApprove(address(stablecoinAdapter), _amount);
        stablecoinAdapter.crossChainTransferOut(msg.sender, _amount);
        stablecoin.safeApprove(address(stablecoinAdapter), 0);
        bookKeeper.handleBridgeOut(_dstChainId, _amount);
        _initAsterizmTransferEvent(_dstChainId, abi.encode(msg.sender, _to, _amount));
        emit logCrossChainTransferOut(_dstChainId, msg.sender, _to, _amount);
    }

    /// Cross-chain fn that triggers when receiving payload from another chain
    /// Minting logic on the receiver side
    function _asterizmReceive(ClAsterizmReceiveRequestDto memory _dto) internal override {
        (address from, address to, uint amount) = abi.decode(_dto.payload, (address, address, uint));
        stablecoinAdapter.crossChainTransferIn(to, amount);
        emit logCrossChainTransferIn(_dto.srcChainId, from, to, amount);
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
