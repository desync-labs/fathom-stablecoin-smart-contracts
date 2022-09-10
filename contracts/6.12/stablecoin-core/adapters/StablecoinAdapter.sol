// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../../interfaces/IStablecoin.sol";
import "../../interfaces/IBookKeeper.sol";
import "../../interfaces/IToken.sol";
import "../../interfaces/IStablecoinAdapter.sol";
import "../../interfaces/ICagable.sol";

// FIXME: This contract was altered compared to the production version.
// It doesn't use LibNote anymore.
// New deployments of this contract will need to include custom events (TO DO).

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

contract StablecoinAdapter is IStablecoinAdapter, ICagable {
    IBookKeeper public override bookKeeper; // CDP Engine
    IStablecoin public override stablecoin; // Stablecoin Token
    uint256 public live; // Active Flag
    constructor(address _bookKeeper, address _stablecoin) public {
        
        live = 1;
        bookKeeper = IBookKeeper(_bookKeeper);
        stablecoin = IStablecoin(_stablecoin);
    }

    /// @dev access: OWNER_ROLE, SHOW_STOPPER_ROLE
    function cage() external override {
        require(live == 1, "StablecoinAdapter/not-live");
        live = 0;
        emit LogCage();
    }

    /// @dev access: OWNER_ROLE, SHOW_STOPPER_ROLE
    function uncage() external override {
        require(live == 0, "StablecoinAdapter/not-caged");
        live = 1;
        emit LogUncage();
    }

    uint256 constant ONE = 10**27;

    function mul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x);
    }

    /// @dev Deposit stablecoin into the system from the caller to be used for debt repayment or liquidation
    /// @param usr The source address which is holding the stablecoin
    /// @param wad The amount of stablecoin to be deposited [wad]
    function deposit(
        address usr,
        uint256 wad,
        bytes calldata /* data */
    ) external payable override {
        bookKeeper.moveStablecoin(address(this), usr, mul(ONE, wad));
        stablecoin.burn(msg.sender, wad);
    }

    /// @dev Withdraw stablecoin from the system to the caller
    /// @param usr The destination address to receive stablecoin
    /// @param wad The amount of stablecoin to be withdrawn [wad]
    function withdraw(
        address usr,
        uint256 wad,
        bytes calldata /* data */
    ) external override {
        require(live == 1, "StablecoinAdapter/not-live");
        bookKeeper.moveStablecoin(msg.sender, address(this), mul(ONE, wad));
        stablecoin.mint(usr, wad);
    }
}
