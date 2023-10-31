// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

interface IProxyWalletExe {
    function execute(bytes memory _data) external payable returns (bytes memory _response);
}

interface IERC {
    function approve(address _spender, uint256 _amount) external;
}

contract ReentrancyAttacker {
    address public proxyWallet;

    constructor(address _proxyWallet) {
        proxyWallet = _proxyWallet;
    }

    function execute(bytes calldata _data) external {
        IProxyWalletExe(proxyWallet).execute(_data);
    }

    function setProxyWallet(address _proxyWallet) external {
        proxyWallet = _proxyWallet;
    }

    function approveWallet(address _tokenAddress) external {
        IERC(_tokenAddress).approve(proxyWallet, 2 * 10 ** 18);
    }
    
    receive() external payable {
        (bool success, ) = proxyWallet.call{ gas: gasleft(), value: msg.value }("");
        require(success, "ReentrancyAttacker/reEntry-failed");
    }
}