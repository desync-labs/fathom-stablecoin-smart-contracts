// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract CommonMath {
    uint256 internal constant BLN = 10 ** 9;
    uint256 internal constant WAD = 10 ** 18;
    uint256 internal constant RAY = 10 ** 27; // one
    uint256 internal constant RAD = 10 ** 45;

    function add(uint256 x, int256 y) internal pure returns (uint256 z) {
        unchecked {
            z = x + uint256(y);
        }
        require(y >= 0 || z <= x);
        require(y <= 0 || z >= x);
    }

    function sub(uint256 x, int256 y) internal pure returns (uint256 z) {
        unchecked {
            z = x - uint256(y);
        }
        require(y <= 0 || z <= x);
        require(y >= 0 || z >= x);
    }

    function mul(uint256 x, int256 y) internal pure returns (int256 z) {
        unchecked {
            z = int256(x) * y;
        }
        require(int256(x) >= 0);
        require(y == 0 || z / y == int256(x));
    }

    function divup(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = (_x + _y - 1) / _y;
    }

    function rdiv(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = (_x * RAY) / _y;
    }

    function wdiv(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
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

    function rpow(uint256 x, uint256 n, uint256 b) internal pure returns (uint256 z) {
        assembly {
            switch x
            case 0 {
                switch n
                case 0 {
                    z := b
                }
                default {
                    z := 0
                }
            }
            default {
                switch mod(n, 2)
                case 0 {
                    z := b
                }
                default {
                    z := x
                }
                let half := div(b, 2) // for rounding.
                for {
                    n := div(n, 2)
                } n {
                    n := div(n, 2)
                } {
                    let xx := mul(x, x)
                    if iszero(eq(div(xx, x), x)) {
                        revert(0, 0)
                    }
                    let xxRound := add(xx, half)
                    if lt(xxRound, xx) {
                        revert(0, 0)
                    }
                    x := div(xxRound, b)
                    if mod(n, 2) {
                        let zx := mul(z, x)
                        if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) {
                            revert(0, 0)
                        }
                        let zxRound := add(zx, half)
                        if lt(zxRound, zx) {
                            revert(0, 0)
                        }
                        z := div(zxRound, b)
                    }
                }
            }
        }
    }

    function toRad(uint256 _wad) internal pure returns (uint256 _rad) {
        _rad = _wad * RAY;
    }
}
