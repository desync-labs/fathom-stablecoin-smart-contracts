// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

contract FathomNote {
    event LogNote(bytes4 indexed _sig, address indexed _guy, bytes32 indexed _foo, bytes32 indexed _bar, uint256 _wad, bytes _fax) anonymous;

    modifier note() {
        bytes32 foo;
        bytes32 bar;
        uint256 wad;

        assembly {
            foo := calldataload(4)
            bar := calldataload(36)
            wad := callvalue()
        }

        _;

        emit LogNote(msg.sig, msg.sender, foo, bar, wad, msg.data);
    }
}
