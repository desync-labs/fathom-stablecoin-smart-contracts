// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "./lib/FathomSwapLibrary.sol";
import "../interfaces/IFathomDEXOracle.sol";

contract DexPriceOracle is Initializable, IFathomDEXOracle {
    using SafeMathUpgradeable for uint256;
    address public dexFactory;

    function initialize(address _dexFactory) external initializer {
        dexFactory = _dexFactory;
    }

    /// @dev Return the wad price of token0/token1, multiplied by 1e18 (if you have 1 token0 how much you can sell it for token1)
    function getPrice(address token0, address token1) external view override returns (uint256, uint256) {
        if (token0 == token1) return (1e18, uint64(block.timestamp));
        (uint256 r0, uint256 r1) = FathomSwapLibrary.getReserves(dexFactory, token0, token1);
        uint256 price = r0.mul(1e18).div(r1);
        return (price, uint64(block.timestamp));
    }
}
