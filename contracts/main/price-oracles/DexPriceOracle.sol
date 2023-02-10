// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./lib/FathomSwapLibrary.sol";
import "../interfaces/IFathomDEXOracle.sol";

contract DexPriceOracle is Initializable, IFathomDEXOracle {
    address public dexFactory;

    function initialize(address _dexFactory) external initializer {
        dexFactory = _dexFactory;
    }

    /// @dev Return the wad price of token0/token1, multiplied by 1e18 (if you have 1 token0 how much you can sell it for token1)
    function getPrice(address token0, address token1)
        external
        view
        override
        returns (uint256, uint256)
    {
        require(token0 != token1, "DexPriceOracle/same-tokens");
        (uint256 r0, uint256 r1) = FathomSwapLibrary.getReserves(dexFactory, token0, token1);

        uint8 decimals0 = ERC20(token0).decimals();
        uint8 decimals1 = ERC20(token1).decimals();

        (uint256 normalized0, uint256 normalized1) = decimals0 >= decimals1
            ? (r0, r1 * (10**(decimals0 - decimals1)))
            : (r0 * (10**(decimals1 - decimals0)), r1);
        uint price = (normalized0 * 1e18) / normalized1;

        return (price, uint64(block.timestamp));
    }
}
