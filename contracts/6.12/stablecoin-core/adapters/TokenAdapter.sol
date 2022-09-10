// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../../interfaces/IBookKeeper.sol";
import "../../interfaces/IToken.sol";
import "../../interfaces/IGenericTokenAdapter.sol";
import "../../interfaces/ICagable.sol";
import "../../utils/SafeToken.sol";

/*
        Here we provide *adapters* to connect the BookKeeper to arbitrary external
        token implementations, creating a bounded context for the BookKeeper. The
        adapters here are provided as working examples:

            - `TokenAdapter`: For well behaved ERC20 tokens, with simple transfer
                                     semantics.

            - `StablecoinAdapter`: For connecting internal Fathom Stablecoin balances to an external
                                     `FathomStablecoin` implementation.

        In practice, adapter implementations will be varied and specific to
        individual collateral types, accounting for different transfer
        semantics and token standards.

        Adapters need to implement two basic methods:

            - `deposit`: enter token into the system
            - `withdraw`: remove token from the system

*/

contract TokenAdapter is IGenericTokenAdapter, ICagable {
    using SafeToken for address;

    IBookKeeper public bookKeeper; // CDP Engine
    bytes32 public override collateralPoolId; // Collateral Type
    address public override collateralToken;
    uint256 public override decimals;
    uint256 public live; // Active Flag

    constructor(
        address _bookKeeper,
        bytes32 collateralPoolId_,
        address collateralToken_
    ) public {
        live = 1;
        bookKeeper = IBookKeeper(_bookKeeper);
        collateralPoolId = collateralPoolId_;
        collateralToken = collateralToken_;
        decimals = IToken(collateralToken).decimals();
        require(decimals == 18, "TokenAdapter/bad-token-decimals");
    }

    /// @dev access: OWNER_ROLE, SHOW_STOPPER_ROLE
    function cage() external override {
        require(live == 1, "TokenAdapter/not-live");
        live = 0;
        emit LogCage();
    }

    /// @dev access: OWNER_ROLE, SHOW_STOPPER_ROLE
    function uncage() external override {
        require(live == 0, "TokenAdapter/not-caged");
        live = 1;
        emit LogUncage();
    }

    /// @dev Deposit token into the system from the caller to be used as collateral
    /// @param usr The source address which is holding the collateral token
    /// @param wad The amount of collateral to be deposited [wad]
    function deposit(
        address usr,
        uint256 wad,
        bytes calldata /* data */
    ) external payable override {
        require(live == 1, "TokenAdapter/not-live");
        require(int256(wad) >= 0, "TokenAdapter/overflow");
        bookKeeper.addCollateral(collateralPoolId, usr, int256(wad));

        // Move the actual token
        address(collateralToken).safeTransferFrom(msg.sender, address(this), wad);
    }

    /// @dev Withdraw token from the system to the caller
    /// @param usr The destination address to receive collateral token
    /// @param wad The amount of collateral to be withdrawn [wad]
    function withdraw(
        address usr,
        uint256 wad,
        bytes calldata /* data */
    ) external override {
        require(wad < 2**255, "TokenAdapter/overflow");
        bookKeeper.addCollateral(collateralPoolId, msg.sender, -int256(wad));

        // Move the actual token
        address(collateralToken).safeTransfer(usr, wad);
    }

    function onAdjustPosition(
        address src,
        address dst,
        int256 collateralValue,
        int256 debtShare,
        bytes calldata data
    ) external override {}

    function onMoveCollateral(
        address src,
        address dst,
        uint256 wad,
        bytes calldata data
    ) external override {}
}
