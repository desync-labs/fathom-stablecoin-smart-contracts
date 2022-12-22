// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "./FathomAuth.sol";
import "./FathomNote.sol";
import "./ProxyWalletCache.sol";

/// @dev Allows code execution using a persistant identity This can be very useful to execute a sequence of atomic actions. Since the owner of
// the proxy can be changed, this allows for dynamic ownership models i.e. a multisig
contract ProxyWallet is FathomAuth, FathomNote {
    ProxyWalletCache public cache; // global cache for contracts

    constructor(address _cacheAddr) {
        setCache(_cacheAddr);
    }

    receive() external payable {}

    /// @dev use the proxy to execute calldata _data on contract _code
    function execute(bytes memory _code, bytes memory _data) external payable returns (address _target, bytes memory _response) {
        _target = cache.read(_code);
        if (_target == address(0)) {
            _target = cache.write(_code); // deploy contract & store its address in cache
        }

        _response = execute2(_target, _data);
    }

    function execute2(address _target, bytes memory _data) public payable auth note returns (bytes memory _response) {
        require(_target != address(0), "proxy-wallet-target-address-required");
        assembly {
            let _succeeded := delegatecall(sub(gas(), 5000), _target, add(_data, 0x20), mload(_data), 0, 0)
            let _size := returndatasize()

            _response := mload(0x40)
            mstore(0x40, add(_response, and(add(add(_size, 0x20), 0x1f), not(0x1f))))
            mstore(_response, _size)
            returndatacopy(add(_response, 0x20), 0, _size)

            switch iszero(_succeeded)
            case 1 {
                revert(add(_response, 0x20), _size)
            }
        }
    }

    function setCache(address _cacheAddr) public auth note returns (bool) {
        require(_cacheAddr != address(0), "proxy-wallet-cache-address-required");
        cache = ProxyWalletCache(_cacheAddr); // overwrite cache
        return true;
    }
}
