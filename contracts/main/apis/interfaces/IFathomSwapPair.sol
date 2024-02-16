// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// solhint-disable func-name-mixedcase
interface IFathomSwapPair {
    event Approval(address indexed _owner, address indexed _spender, uint _value);
    event Transfer(address indexed _from, address indexed _to, uint _value);

    event Mint(address indexed _sender, uint _amount0, uint _amount1);
    event Burn(address indexed _sender, uint _amount0, uint _amount1, address indexed _to);
    event Swap(address indexed _sender, uint _amount0In, uint _amount1In, uint _amount0Out, uint _amount1Out, address indexed _to);
    event Sync(uint112 _reserve0, uint112 _reserve1);

    function approve(address _spender, uint _value) external returns (bool);

    function transfer(address _to, uint _value) external returns (bool);

    function transferFrom(address _from, address _to, uint _value) external returns (bool);

    function permit(address _owner, address _spender, uint _value, uint _deadline, uint8 _v, bytes32 _r, bytes32 _s) external;

    function mint(address _to) external returns (uint liquidity);

    function burn(address _to) external returns (uint amount0, uint amount1);

    function swap(uint _amount0Out, uint _amount1Out, address _to, bytes calldata _data) external;

    function skim(address _to) external;

    function sync() external;

    function initialize(address, address) external;

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function nonces(address _owner) external view returns (uint);

    function totalSupply() external view returns (uint);

    function balanceOf(address _owner) external view returns (uint);

    function allowance(address _owner, address _spender) external view returns (uint);

    function factory() external view returns (address);

    function token0() external view returns (address);

    function token1() external view returns (address);

    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);

    function price0CumulativeLast() external view returns (uint);

    function price1CumulativeLast() external view returns (uint);

    function kLast() external view returns (uint);

    function name() external pure returns (string memory);

    function symbol() external pure returns (string memory);

    function decimals() external pure returns (uint8);

    function PERMIT_TYPEHASH() external pure returns (bytes32);

    function MINIMUM_LIQUIDITY() external pure returns (uint);
}
// solhint-enable func-name-mixedcase
