// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IAuthority.sol";

contract FathomAuthEvents {
    event LogSetAuthority(address indexed _authority);
    event LogSetOwner(address indexed _owner);
}

contract FathomAuth is FathomAuthEvents {
    IAuthority public authority;
    address public owner;

    constructor() {
        owner = msg.sender;
        emit LogSetOwner(msg.sender);
    }

    function setOwner(address _owner) external onlyOwner {
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

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner allowed");
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
