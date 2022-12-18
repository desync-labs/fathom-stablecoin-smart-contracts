// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../interfaces/IStablecoinAdapter.sol";
import "../interfaces/IStablecoin.sol";
import "../interfaces/IBookKeeper.sol";
import "../interfaces/IAuthTokenAdapter.sol";
import "../interfaces/IStableSwapModule.sol";
import "../utils/SafeToken.sol";

// Stable Swap Module
// Allows anyone to go between FUSD and the Token by pooling the liquidity
// An optional fee is charged for incoming and outgoing transfers
contract StableSwapModule is PausableUpgradeable, ReentrancyGuardUpgradeable, IStableSwapModule {
    using SafeToken for address;

    IBookKeeper public bookKeeper;
    IAuthTokenAdapter public override authTokenAdapter;
    IStablecoin public stablecoin;
    IStablecoinAdapter public override stablecoinAdapter;
    bytes32 public collateralPoolId;
    address public systemDebtEngine;

    uint256 internal to18ConversionFactor;

    uint256 public feeIn; // fee in [wad]
    uint256 public feeOut; // fee out [wad]

    event LogSetFeeIn(address indexed _caller, uint256 _feeIn);
    event LogSetFeeOut(address indexed _caller, uint256 _feeOut);
    event LogSwapTokenToStablecoin(address indexed _owner, uint256 _value, uint256 _fee);
    event LogSwapStablecoinToToken(address indexed _owner, uint256 _value, uint256 _fee);

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    function initialize(address _authTokenAdapter, address _stablecoinAdapter, address _systemDebtEngine) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        IAuthTokenAdapter __authTokenAdapter = authTokenAdapter = IAuthTokenAdapter(_authTokenAdapter);
        IStablecoinAdapter __stablecoinAdapter = stablecoinAdapter = IStablecoinAdapter(_stablecoinAdapter);
        IBookKeeper _bookKeeper = bookKeeper = IBookKeeper(address(__authTokenAdapter.bookKeeper()));
        IStablecoin _stablecoin = stablecoin = IStablecoin(address(__stablecoinAdapter.stablecoin()));
        collateralPoolId = __authTokenAdapter.collateralPoolId();
        systemDebtEngine = _systemDebtEngine;
        to18ConversionFactor = 10 ** (18 - __authTokenAdapter.decimals());
        address(_stablecoin).safeApprove(_stablecoinAdapter, type(uint).max);
        _bookKeeper.whitelist(_stablecoinAdapter);
    }

    uint256 constant WAD = 10 ** 18;
    uint256 constant RAY = 10 ** 27;

    function add(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x + _y) >= _x);
    }

    function sub(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x - _y) <= _x);
    }

    function mul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y == 0 || (_z = _x * _y) / _y == _x);
    }

    function setFeeIn(uint256 _feeIn) external onlyOwner {
        require(_feeIn <= 5 * 1e17, "StableSwapModule/invalid-fee-in"); // Max feeIn is 0.5 Ethers or 50%
        feeIn = _feeIn;
        emit LogSetFeeIn(msg.sender, _feeIn);
    }

    function setFeeOut(uint256 _feeOut) external onlyOwner {
        require(_feeOut <= 5 * 1e17, "StableSwapModule/invalid-fee-in"); // Max feeOut is 0.5 Ethers or 50%
        feeOut = _feeOut;
        emit LogSetFeeOut(msg.sender, _feeOut);
    }

    function whitelist(address _usr) external onlyOwner {
        bookKeeper.whitelist(_usr);
    }

    function blacklist(address _usr) external onlyOwner {
        bookKeeper.blacklist(_usr);
    }

    function swapTokenToStablecoin(address _usr, uint256 _tokenAmount) external override nonReentrant whenNotPaused {
        require(_tokenAmount != 0, "StableSwapModule/amount-zero");
        uint256 _tokenAmount18 = mul(_tokenAmount, to18ConversionFactor);
        uint256 _fee = mul(_tokenAmount18, feeIn) / WAD;
        uint256 _stablecoinAmount = sub(_tokenAmount18, _fee);
        authTokenAdapter.deposit(address(this), _tokenAmount, msg.sender);
        bookKeeper.adjustPosition(collateralPoolId, address(this), address(this), address(this), int256(_tokenAmount18), int256(_tokenAmount18));
        bookKeeper.moveStablecoin(address(this), systemDebtEngine, mul(_fee, RAY));
        stablecoinAdapter.withdraw(_usr, _stablecoinAmount, abi.encode(0));

        emit LogSwapTokenToStablecoin(_usr, _tokenAmount, _fee);
    }

    function swapStablecoinToToken(address _usr, uint256 _tokenAmount) external override nonReentrant whenNotPaused {
        require(_tokenAmount != 0, "StableSwapModule/amount-zero");
        uint256 _tokenAmount18 = mul(_tokenAmount, to18ConversionFactor);
        uint256 _fee = mul(_tokenAmount18, feeOut) / WAD;
        uint256 _stablecoinAmount = add(_tokenAmount18, _fee);
        address(stablecoin).safeTransferFrom(msg.sender, address(this), _stablecoinAmount);
        stablecoinAdapter.deposit(address(this), _stablecoinAmount, abi.encode(0));
        bookKeeper.adjustPosition(collateralPoolId, address(this), address(this), address(this), -int256(_tokenAmount18), -int256(_tokenAmount18));
        authTokenAdapter.withdraw(_usr, _tokenAmount);
        bookKeeper.moveStablecoin(address(this), systemDebtEngine, mul(_fee, RAY));
        emit LogSwapStablecoinToToken(_usr, _tokenAmount, _fee);
    }

    function pause() external onlyOwnerOrGov {
        _pause();
    }

    function unpause() external onlyOwnerOrGov {
        _unpause();
    }
}
