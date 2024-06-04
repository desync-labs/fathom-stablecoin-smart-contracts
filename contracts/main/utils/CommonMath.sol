// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract CommonMath {
    uint256 internal constant BLN = 10 ** 9;
    uint256 internal constant WAD = 10 ** 18;
    uint256 internal constant RAY = 10 ** 27; // one
    uint256 internal constant RAD = 10 ** 45;

    function add(uint256 _x, int256 _y) internal pure returns (uint256 z) {
        unchecked {
            z = _x + uint256(_y);
        }
        require(_y >= 0 || z <= _x);
        require(_y <= 0 || z >= _x);
    }

    function sub(uint256 _x, int256 _y) internal pure returns (uint256 z) {
        unchecked {
            z = _x - uint256(_y);
        }
        require(_y <= 0 || z <= _x);
        require(_y >= 0 || z >= _x);
    }

    function mul(uint256 _x, int256 _y) internal pure returns (int256 z) {
        unchecked {
            z = int256(_x) * _y;
        }
        require(int256(_x) >= 0);
        require(_y == 0 || z / _y == int256(_x));
    }

    function divup(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y != 0, "CommonMath/zero-division");
        _z = (_x + _y - 1) / _y;
    }

    function rdiv(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y != 0, "CommonMath/zero-division");
        _z = (_x * RAY) / _y;
    }

    function wdiv(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y != 0, "CommonMath/zero-division");
        _z = (_x * WAD) / _y;
    }

    function wdivup(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = divup(_x * WAD, _y);
    }

    function wmul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = (_x * _y) / WAD;
    }

    function rmul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = (_x * _y) / RAY;
    }

    function rmulup(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = divup(_x * _y, RAY);
    }

    function min(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        return _x <= _y ? _x : _y;
    }

    function diff(uint256 _x, uint256 _y) internal pure returns (int256 _z) {
        _z = int256(_x) - int256(_y);
        require(int256(_x) >= 0 && int256(_y) >= 0);
    }

    function both(bool _x, bool _y) internal pure returns (bool _z) {
        assembly {
            _z := and(_x, _y)
        }
    }

    function either(bool _x, bool _y) internal pure returns (bool _z) {
        assembly {
            _z := or(_x, _y)
        }
    }

    function rpow(uint256 _x, uint256 _n, uint256 _b) internal pure returns (uint256 z) {
        assembly {
            switch _x
            case 0 {
                switch _n
                case 0 {
                    z := _b
                }
                default {
                    z := 0
                }
            }
            default {
                switch mod(_n, 2)
                case 0 {
                    z := _b
                }
                default {
                    z := _x
                }
                let half := div(_b, 2) // for rounding.
                for {
                    _n := div(_n, 2)
                } _n {
                    _n := div(_n, 2)
                } {
                    let xx := mul(_x, _x)
                    if iszero(eq(div(xx, _x), _x)) {
                        revert(0, 0)
                    }
                    let xxRound := add(xx, half)
                    if lt(xxRound, xx) {
                        revert(0, 0)
                    }
                    _x := div(xxRound, _b)
                    if mod(_n, 2) {
                        let zx := mul(z, _x)
                        if and(iszero(iszero(_x)), iszero(eq(div(zx, _x), z))) {
                            revert(0, 0)
                        }
                        let zxRound := add(zx, half)
                        if lt(zxRound, zx) {
                            revert(0, 0)
                        }
                        z := div(zxRound, _b)
                    }
                }
            }
        }
    }

    function toRad(uint256 _wad) internal pure returns (uint256 _rad) {
        _rad = _wad * RAY;
    }
}
