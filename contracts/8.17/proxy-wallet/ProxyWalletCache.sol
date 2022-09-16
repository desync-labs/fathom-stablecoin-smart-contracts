// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

contract ProxyWalletCache {
  mapping(bytes32 => address) cache;

  function read(bytes memory _code) public view returns (address) {
    bytes32 hash = keccak256(_code);
    return cache[hash];
  }

  function write(bytes memory _code) external returns (address _target) {
    assembly {
      _target := create(0, add(_code, 0x20), mload(_code))
      switch iszero(extcodesize(_target))
      case 1 {
        // throw if contract failed to deploy
        revert(0, 0)
      }
    }
    bytes32 hash = keccak256(_code);
    cache[hash] = _target;
  }
}
