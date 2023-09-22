// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../../main/interfaces/IBookKeeper.sol";
import "../../main/interfaces/IToken.sol";
import "../../main/interfaces/IGenericTokenAdapter.sol";
import "../../main/interfaces/ICagable.sol";
import "../../main/utils/SafeToken.sol";

contract TokenAdapter is PausableUpgradeable, ReentrancyGuardUpgradeable, IGenericTokenAdapter, ICagable {
    using SafeToken for address;

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    modifier onlyOwnerOrShowStopper() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.SHOW_STOPPER_ROLE(), msg.sender),
            "!(ownerRole or showStopperRole)"
        );
        _;
    }

    IBookKeeper public bookKeeper; // CDP Engine
    bytes32 public override collateralPoolId; // Collateral Type
    address public override collateralToken;
    uint256 public override decimals;
    uint256 public live; // Active Flag

    function initialize(address _bookKeeper, bytes32 collateralPoolId_, address collateralToken_) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        live = 1;
        bookKeeper = IBookKeeper(_bookKeeper);
        collateralPoolId = collateralPoolId_;
        collateralToken = collateralToken_;
        decimals = IToken(collateralToken).decimals();
        require(decimals == 18, "TokenAdapter/bad-token-decimals");
    }

    function cage() external override onlyOwnerOrShowStopper {
        if (live == 1) {
            live = 0;
            emit LogCage();
        }
    }

    function deposit(address usr, uint256 wad, bytes calldata /* data */) external override nonReentrant whenNotPaused {
        require(live == 1, "TokenAdapter/not-live");
        require(int256(wad) >= 0, "TokenAdapter/overflow");
        bookKeeper.addCollateral(collateralPoolId, usr, int256(wad));

        // Move the actual token
        address(collateralToken).safeTransferFrom(msg.sender, address(this), wad);
    }

    function withdraw(address usr, uint256 wad, bytes calldata /* data */) external override nonReentrant whenNotPaused {
        require(wad < 2 ** 255, "TokenAdapter/overflow");
        bookKeeper.addCollateral(collateralPoolId, msg.sender, -int256(wad));

        address(collateralToken).safeTransfer(usr, wad);
    }

    function emergencyWithdraw(address _to) external nonReentrant {
        if (live == 0) {
            uint256 _amount = bookKeeper.collateralToken(collateralPoolId, msg.sender);
            bookKeeper.addCollateral(collateralPoolId, msg.sender, -int256(_amount));

            address(collateralToken).safeTransfer(_to, _amount);
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
