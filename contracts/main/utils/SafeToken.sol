// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/Address.sol";

interface ERC20Interface {
    function balanceOf(address _user) external view returns (uint256);

    function approve(address _to, uint256 _value) external returns (bool);

    function transfer(address _to, uint256 _value) external returns (bool);

    function transferFrom(address from, address _to, uint256 _value) external returns (bool);
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
        (bool success, bytes memory data) = _token.call(abi.encodeCall(ERC20Interface.approve, (_to, _value)));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "!safeApprove");
    }

    function safeTransfer(address _token, address _to, uint256 _value) internal {
        require(Address.isContract(_token), "safeTransfer: non-contract address");
        (bool success, bytes memory data) = _token.call(abi.encodeCall(ERC20Interface.transfer, (_to, _value)));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "!safeTransfer");
    }

    function safeTransferFrom(address _token, address from, address _to, uint256 _value) internal {
        require(Address.isContract(_token), "safeTransferFrom: non-contract address");
        (bool success, bytes memory data) = _token.call(abi.encodeCall(ERC20Interface.transferFrom, (from, _to, _value)));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "!safeTransferFrom");
    }

    function safeTransferETH(address _to, uint256 _value) internal {
        (bool success, ) = _to.call{ value: _value, gas: 21000 }(new bytes(0));
        require(success, "!safeTransferETH");
    }
}
