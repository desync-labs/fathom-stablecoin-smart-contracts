// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../../interfaces/IStablecoin.sol";
import "../../interfaces/IBookKeeper.sol";
import "../../interfaces/IToken.sol";
import "../../interfaces/IStablecoinAdapter.sol";
import "../../interfaces/ICagable.sol";

contract StablecoinAdapter is PausableUpgradeable, ReentrancyGuardUpgradeable, IStablecoinAdapter, ICagable {
    IBookKeeper public override bookKeeper; // CDP Engine
    IStablecoin public override stablecoin; // Stablecoin Token
    uint256 public live; // Active Flag

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    modifier onlyOwnerOrShowStopper() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.SHOW_STOPPER_ROLE(), msg.sender),
            "!(ownerRole or showStopperRole)"
        );
        _;
    }

    function initialize(address _bookKeeper, address _stablecoin) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        live = 1;
        bookKeeper = IBookKeeper(_bookKeeper);
        stablecoin = IStablecoin(_stablecoin);
    }

    function cage() external override onlyOwnerOrShowStopper {
        require(live == 1, "StablecoinAdapter/not-live");
        live = 0;
        emit LogCage();
    }

    function uncage() external override onlyOwnerOrShowStopper {
        require(live == 0, "StablecoinAdapter/not-caged");
        live = 1;
        emit LogUncage();
    }

    uint256 constant ONE = 10 ** 27;

    function mul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x);
    }

    function deposit(address usr, uint256 wad, bytes calldata /* data */) external payable override nonReentrant whenNotPaused {
        bookKeeper.moveStablecoin(address(this), usr, mul(ONE, wad));
        stablecoin.burn(msg.sender, wad);
    }

    function depositRAD(address usr, uint256 ray, bytes calldata /* data */) external payable override nonReentrant whenNotPaused {
        bookKeeper.moveStablecoin(address(this), usr, ray);
        stablecoin.burn(msg.sender, (ray / ONE) + 1);
    }

    function withdraw(address usr, uint256 wad, bytes calldata /* data */) external override nonReentrant whenNotPaused {
        require(live == 1, "StablecoinAdapter/not-live");
        bookKeeper.moveStablecoin(msg.sender, address(this), mul(ONE, wad));
        stablecoin.mint(usr, wad);
    }

    function pause() external onlyOwnerOrGov {
        _pause();
    }

    function unpause() external onlyOwnerOrGov {
        _unpause();
    }
}
