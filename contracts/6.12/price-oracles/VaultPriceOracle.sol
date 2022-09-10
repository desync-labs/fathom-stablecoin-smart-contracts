// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../interfaces/IFathomOracle.sol";
import "../interfaces/IFathomVault.sol";

contract VaultPriceOracle is IFathomOracle {
    mapping(address => bool) public vaults;

    // function initialize() external initializer {}

    event LogSetVault(address indexed _vault, bool _isOk);

    /// @dev Return the wad price of token0/token1, multiplied by 1e18
    /// NOTE: (if you have 1 token0 how much you can sell it for token1)
    function getPrice(address token0, address token1) external view override returns (uint256, uint256) {
        if (vaults[token0] && IFathomVault(token0).token() == token1) {
            return ((IFathomVault(token0).totalToken() * (1e18)) / (IFathomVault(token0).totalSupply()), uint64(now));
        }
        if (vaults[token1] && IFathomVault(token1).token() == token0) {
            return ((IFathomVault(token1).totalSupply() * (1e18)) / (IFathomVault(token1).totalToken()), uint64(now));
        }
        return (0, 0);
    }

    function setVault(address _vault, bool _isOk) external {
        if (_isOk) {
            // sanity check
            IFathomVault(_vault).totalToken();
        }
        vaults[_vault] = _isOk;

        emit LogSetVault(_vault, _isOk);
    }
}
