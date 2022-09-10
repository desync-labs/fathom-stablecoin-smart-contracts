// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022
pragma solidity 0.6.12;

import "../../interfaces/IBookKeeper.sol";
import "../../interfaces/IToken.sol";
import "../../interfaces/IAuthTokenAdapter.sol";
import "../../interfaces/ICagable.sol";
import "../../utils/SafeToken.sol";

// Authed TokenAdapter for a token that has a lower precision than 18 and it has decimals (like USDC)

contract AuthTokenAdapter is
    IAuthTokenAdapter,
    ICagable
{
    using SafeToken for address;

    bytes32 public constant WHITELISTED = keccak256("WHITELISTED");

    IBookKeeper public override bookKeeper; // cdp engine
    bytes32 public override collateralPoolId; // collateral pool id
    IToken public override token; // collateral token
    uint256 public override decimals; // collateralToken decimals
    uint256 public live; // Access Flag

    // --- Events ---
    event LogDeposit(address indexed urn, uint256 wad, address indexed msgSender);
    event LogWithdraw(address indexed guy, uint256 wad);

    constructor(
        address _bookKeeper,
        bytes32 _collateralPoolId,
        address _token
    ) public {
        token = IToken(_token);
        decimals = IToken(_token).decimals();
        live = 1;
        bookKeeper = IBookKeeper(_bookKeeper);
        collateralPoolId = _collateralPoolId;
    }

    /// @dev access: OWNER_ROLE, SHOW_STOPPER_ROLE
    function cage() external override {
        require(live == 1, "AuthTokenAdapter/not-live");
        live = 0;
        emit LogCage();
    }

    /// @dev access: OWNER_ROLE, SHOW_STOPPER_ROLE
    function uncage() external override {
        require(live == 0, "AuthTokenAdapter/not-caged");
        live = 1;
        emit LogUncage();
    }

    function mul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y == 0 || (_z = _x * _y) / _y == _x, "AuthTokenAdapter/overflow");
    }

    /**
     * @dev Deposit token into the system from the msgSender to be used as collateral
     * @param _urn The destination address which is holding the collateral token
     * @param _wad The amount of collateral to be deposit [wad]
     * @param _msgSender The source address which transfer token
     * @dev access: WHITELISTED
     */
    function deposit(
        address _urn,
        uint256 _wad,
        address _msgSender
    ) external override {
        // require(hasRole(WHITELISTED, msg.sender), "AuthTokenAdapter/not-whitelisted");
        require(live == 1, "AuthTokenAdapter/not-live");
        uint256 _wad18 = mul(_wad, 10**(18 - decimals));
        require(int256(_wad18) >= 0, "AuthTokenAdapter/overflow");
        bookKeeper.addCollateral(collateralPoolId, _urn, int256(_wad18));
        address(token).safeTransferFrom(_msgSender, address(this), _wad);
        emit LogDeposit(_urn, _wad, _msgSender);
    }

    /**
     * @dev Withdraw token from the system to guy
     * @param _guy The destination address to receive collateral token
     * @param _wad The amount of collateral to be withdraw [wad]
     */
    function withdraw(address _guy, uint256 _wad) external override {
        uint256 _wad18 = mul(_wad, 10**(18 - decimals));
        require(int256(_wad18) >= 0, "AuthTokenAdapter/overflow");
        bookKeeper.addCollateral(collateralPoolId, msg.sender, -int256(_wad18));
        address(token).safeTransfer(_guy, _wad);
        emit LogWithdraw(_guy, _wad);
    }
}
