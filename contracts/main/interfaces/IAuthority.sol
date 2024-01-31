// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IAuthority {
    function canCall(address _src, address _dst, bytes4 _sig) external view returns (bool);
}
