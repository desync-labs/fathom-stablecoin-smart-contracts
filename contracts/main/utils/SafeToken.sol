// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/Address.sol";

interface ERC20Interface {
    function balanceOf(address _user) external view returns (uint256);
}

library SafeToken {
    function myBalance(address _token) internal view returns (uint256) {
        return ERC20Interface(_token).balanceOf(address(this));
    }

    function balanceOf(address _token, address _user) internal view returns (uint256) {
        return ERC20Interface(_token).balanceOf(_user);
    }

    function safeApprove(address _token, address _to, uint256 _value) internal {
        require(Address.isContract(_token), "safeApprove: non-contract address");
        (bool success, bytes memory data) = _token.call(abi.encodeWithSelector(0x095ea7b3, _to, _value)); // bytes4(keccak256(bytes('approve(address,uint256)')));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "!safeApprove");
    }

    function safeTransfer(address _token, address _to, uint256 _value) internal {
        require(Address.isContract(_token), "safeTransfer: non-contract address");
        (bool success, bytes memory data) = _token.call(abi.encodeWithSelector(0xa9059cbb, _to, _value)); // bytes4(keccak256(bytes('transfer(address,uint256)')));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "!safeTransfer");
    }

    function safeTransferFrom(address _token, address from, address _to, uint256 _value) internal {
        require(Address.isContract(_token), "safeTransferFrom: non-contract address");
        (bool success, bytes memory data) = _token.call(abi.encodeWithSelector(0x23b872dd, from, _to, _value)); // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "!safeTransferFrom");
    }

    function safeTransferETH(address _to, uint256 _value) internal {
        (bool success, ) = _to.call{ value: _value, gas: 21000 }(new bytes(0));
        require(success, "!safeTransferETH");
    }
}
