// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IERC165 {
    /// @dev Returns true if this contract implements the interface defined by
    /// `_interfaceId`. See the corresponding
    /// https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
    /// to learn more about how these ids are created.
    ///
    /// This function call must use less than 30 000 gas.
    function supportsInterface(bytes4 _interfaceId) external view returns (bool);
}
