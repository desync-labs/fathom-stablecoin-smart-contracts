// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

interface IProxyWalletExe2 {
    function execute(bytes memory _data) external payable returns (bytes memory _response);
}

interface IERC2 {
    function approve(address _spender, uint256 _amount) external;
}

contract ReentrancyAttacker2 {
    address public proxyWallet;

    constructor(address _proxyWallet) {
        proxyWallet = _proxyWallet;
    }

    function execute(bytes calldata _data) external {
        IProxyWalletExe2(proxyWallet).execute(_data);
    }

    function setProxyWallet(address _proxyWallet) external {
        proxyWallet = _proxyWallet;
    }

    function approveWallet(address _tokenAddress) external {
        IERC2(_tokenAddress).approve(proxyWallet, 2 * 10 ** 18);
    }

    receive() external payable {
        bytes memory encodedData = abi.encodeWithSignature("execute(bytes)", "0x134");
        (bool success, ) = proxyWallet.call{ gas: gasleft() }(encodedData);
        require(success, "ReentrancyAttacker/reEntry-failed");
    }
}
