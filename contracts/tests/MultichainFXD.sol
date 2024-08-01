// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "asterizmprotocol/contracts/evm/AsterizmClient.sol";

contract MultichainFXD is Ownable, ERC20, AsterizmClient {
    constructor(IInitializerSender _initializerLib, uint _initialSupply)
    ERC20("MultichainFXD", "MFXD")
    AsterizmClient(_initializerLib, true, false)
    {
        _mint(_msgSender(), _initialSupply);
    }

    /// Cross-chain transfer
    /// @param _dstChainId uint64  Destination chain ID
    /// @param _to address  To address
    /// @param _amount uint  Amount to bridge transfer
    function crossChainTransfer(uint64 _dstChainId, address _to, uint _amount) public payable {
        uint amount = _debitFrom(msg.sender, _amount); // amount returned should not have dust
        require(amount > 0, "MultichainToken: amount too small");
        _initAsterizmTransferEvent(_dstChainId, abi.encode(msg.sender, _to, _amount));
    }

    /// Debit logic
    /// @param _from address  From address
    /// @param _amount uint  Amount
    function _debitFrom(address _from, uint _amount) internal virtual returns(uint) {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        _burn(_from, _amount);
        return _amount;
    }
    /// Minting logic on the receiver side
    function _asterizmReceive(ClAsterizmReceiveRequestDto memory _dto) internal override {
        (address from, address to, uint256 amount ) = abi.decode(_dto.payload, (address, uint, uint));
        _mint(to, amount);
    }

}
