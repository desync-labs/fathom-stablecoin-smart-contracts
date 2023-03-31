// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;
import "../main/interfaces/IStableSwapModule.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
contract StableswapMultipleSwapsMock {
    

    //@notice: A mock feature to test whether twoStableswaps can happen in same block.
    //@notice: The decentralizedState in StableSwapModule.sol contract  must be true for this swap to fail
    function twoStablecoinToTokenSwapAtSameBlock(address _stableswap,address _token, uint256 _tokenAmount) public {
        IERC20(_token).transferFrom(msg.sender,address(this),4 * _tokenAmount);
        IERC20(_token).approve(_stableswap, 4 * _tokenAmount);
        (bool success1, bytes memory result1) = _stableswap.call(
            abi.encodeWithSignature("swapStablecoinToToken(address,uint256)", address(this), _tokenAmount));
        Address.verifyCallResult(success1, result1, "no error message bubbled up - for first swap");
        (bool success2, bytes memory result2) = _stableswap.call(
            abi.encodeWithSignature("swapStablecoinToToken(address,uint256)", address(this), _tokenAmount));
        Address.verifyCallResult(success2, result2, "no error message bubbled up - for second swap");
    }

    //@notice: A mock feature to test whether twoStableswaps can happen in same block.
    //@notice: The decentralizedState in StableSwapModule.sol contract  must be true for this swap to fail
    function twoTokenToStablecoinSwapAtSameBlock(address _stableswap,address _token, uint256 _tokenAmount) public {
        IERC20(_token).transferFrom(msg.sender,address(this),4 * _tokenAmount);
        IERC20(_token).approve(_stableswap, 4 * _tokenAmount);
        (bool success1, bytes memory result1) = _stableswap.call(
            abi.encodeWithSignature("swapTokenToStablecoin(address,uint256)", address(this), _tokenAmount));
        Address.verifyCallResult(success1, result1, "no error message bubbled up - for first swap");
        (bool success2, bytes memory result2) = _stableswap.call(
            abi.encodeWithSignature("swapTokenToStablecoin(address,uint256)", address(this), _tokenAmount));
        Address.verifyCallResult(success2, result2, "no error message bubbled up - for second swap");
    }
}