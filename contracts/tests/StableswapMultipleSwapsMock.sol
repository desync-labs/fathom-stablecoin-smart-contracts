// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;
import "../main/interfaces/IStableSwapModule.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
contract StableswapMultipleSwapsMock {
    //@notice: A mock feature to test whether twoStableswaps can happen in same block.
    //@notice: The decentralizedState in StableSwapModule.sol contract  must be true for this swap to fail
    function twoStableSwapAtOneBlock(address _stableswap,address _token, uint256 _tokenAmount) public {
        IERC20(_token).transferFrom(msg.sender,address(this),2 * _tokenAmount);
        IERC20(_token).approve(_stableswap, 2 * _tokenAmount);
        (bool success1, bytes memory result1) = _stableswap.call(
            abi.encodeWithSignature("swapTokenToStablecoin(address,uint256)", address(this), _tokenAmount));
        
        verifyCallResult(success1, result1, "no error message - for first swap");
        (bool success2, bytes memory result2) = _stableswap.call(
            abi.encodeWithSignature("swapStablecoinToToken(address,uin256)", address(this), _tokenAmount));
        verifyCallResult(success2, result2, "no error message - for second swap");
    }

    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly
                /// @solidity memory-safe-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }
}