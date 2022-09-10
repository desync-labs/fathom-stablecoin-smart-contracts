// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../interfaces/IAuth.sol";

contract FathomAuthEvents {
    event LogSetAuthority(address indexed _authority);
    event LogSetOwner(address indexed _owner);
}

contract FathomAuth is FathomAuthEvents {
    IAuthority public authority;
    address public owner;

    constructor() public {
        owner = msg.sender;
        emit LogSetOwner(msg.sender);
    }

    function setOwner(address _owner) external auth {
        owner = _owner;
        emit LogSetOwner(owner);
    }

    function setAuthority(IAuthority _authority) external auth {
        authority = _authority;
        emit LogSetAuthority(address(authority));
    }

    modifier auth() {
        require(isAuthorized(msg.sender, msg.sig), "fathom-auth-unauthorized");
        _;
    }

    function isAuthorized(address _src, bytes4 _sig) internal view returns (bool) {
        if (_src == address(this)) {
            return true;
        } else if (_src == owner) {
            return true;
        } else if (address(authority) == address(0)) {
            return false;
        } else {
            return authority.canCall(_src, address(this), _sig);
        }
    }
}
