// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "./FathomAuth.sol";
import "./FathomNote.sol";
import "./ProxyActionsStorage.sol";

/// @dev Allows code execution using a persistant identity This can be very useful to execute a sequence of atomic actions. Since the owner of
// the proxy can be changed, this allows for dynamic ownership models i.e. a multisig
contract ProxyWallet is FathomAuth, FathomNote {
    // ProxyWalletCache public cache; // global cache for contracts
    ProxyActionsStorage public proxyActionsStorage;

    constructor(address _storage) {
        proxyActionsStorage = ProxyActionsStorage(_storage);
    }

    receive() external payable {}

    function execute(bytes memory _data) public payable auth note returns (bytes memory _response) {
        address target = proxyActionsStorage.proxyAction();
        assembly {
            let _succeeded := delegatecall(sub(gas(), 5000), target, add(_data, 0x20), mload(_data), 0, 0)
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
}
