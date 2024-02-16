// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IUniswapV2Router01 {
    function factory() external pure returns (address);

    function WETH() external pure returns (address);

    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint _amountADesired,
        uint _amountBDesired,
        uint _amountAMin,
        uint _amountBMin,
        address _to,
        uint _deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);

    function addLiquidityETH(
        address _token,
        uint _amountTokenDesired,
        uint _amountTokenMin,
        uint _amountETHMin,
        address _to,
        uint _deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);

    function removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint _liquidity,
        uint _amountAMin,
        uint _amountBMin,
        address _to,
        uint _deadline
    ) external returns (uint amountA, uint amountB);

    function removeLiquidityETH(
        address _token,
        uint _liquidity,
        uint _amountTokenMin,
        uint _amountETHMin,
        address _to,
        uint _deadline
    ) external returns (uint amountToken, uint amountETH);

    function removeLiquidityWithPermit(
        address _tokenA,
        address _tokenB,
        uint _liquidity,
        uint _amountAMin,
        uint _amountBMin,
        address _to,
        uint _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external returns (uint amountA, uint amountB);

    function removeLiquidityETHWithPermit(
        address _token,
        uint _liquidity,
        uint _amountTokenMin,
        uint _amountETHMin,
        address _to,
        uint _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external returns (uint amountToken, uint amountETH);

    function swapExactTokensForTokens(
        uint _amountIn,
        uint _amountOutMin,
        address[] calldata _path,
        address _to,
        uint _deadline
    ) external returns (uint[] memory amounts);

    function swapTokensForExactTokens(
        uint _amountOut,
        uint _amountInMax,
        address[] calldata _path,
        address _to,
        uint _deadline
    ) external returns (uint[] memory amounts);

    function swapExactETHForTokens(
        uint _amountOutMin,
        address[] calldata _path,
        address _to,
        uint _deadline
    ) external payable returns (uint[] memory amounts);

    function swapTokensForExactETH(
        uint _amountOut,
        uint _amountInMax,
        address[] calldata _path,
        address _to,
        uint _deadline
    ) external returns (uint[] memory amounts);

    function swapExactTokensForETH(
        uint _amountIn,
        uint _amountOutMin,
        address[] calldata _path,
        address _to,
        uint _deadline
    ) external returns (uint[] memory amounts);

    function swapETHForExactTokens(
        uint _amountOut,
        address[] calldata _path,
        address _to,
        uint _deadline
    ) external payable returns (uint[] memory amounts);

    function quote(uint _amountA, uint _reserveA, uint _reserveB) external pure returns (uint amountB);

    function getAmountOut(uint _amountIn, uint _reserveIn, uint _reserveOut) external pure returns (uint amountOut);

    function getAmountIn(uint _amountOut, uint _reserveIn, uint _reserveOut) external pure returns (uint amountIn);

    function getAmountsOut(uint _amountIn, address[] calldata _path) external view returns (uint[] memory amounts);

    function getAmountsIn(uint _amountOut, address[] calldata _path) external view returns (uint[] memory amounts);
}
