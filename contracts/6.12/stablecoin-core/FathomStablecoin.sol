// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;



import "../interfaces/IStablecoin.sol";

// FIXME: This contract was altered compared to the production version.
// It doesn't use LibNote anymore.
// New deployments of this contract will need to include custom events (TO DO).

contract FathomStablecoin is IStablecoin {

    // --- ERC20 Data ---
    string public name; // Fathom USD Stablecoin
    string public symbol; // AUSD
    string public constant version = "1";
    uint8 public constant override decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public nonces;

    event Approval(address indexed src, address indexed guy, uint256 wad);
    event Transfer(address indexed src, address indexed dst, uint256 wad);

    // --- Math ---
    function add(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x + _y) >= _x);
    }

    function sub(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x - _y) <= _x);
    }

    // --- Init ---
    constructor(string memory _name, string memory _symbol) public {

        name = _name;
        symbol = _symbol;
    }

    // --- Token ---
    function transfer(address _dst, uint256 _wad) external override returns (bool) {
        return transferFrom(msg.sender, _dst, _wad);
    }

    function transferFrom(
        address _src,
        address _dst,
        uint256 _wad
    ) public override returns (bool) {
        require(balanceOf[_src] >= _wad, "FathomStablecoin/insufficient-balance");
        if (_src != msg.sender && allowance[_src][msg.sender] != uint256(-1)) {
            require(allowance[_src][msg.sender] >= _wad, "FathomStablecoin/insufficient-allowance");
            allowance[_src][msg.sender] = sub(allowance[_src][msg.sender], _wad);
        }
        balanceOf[_src] = sub(balanceOf[_src], _wad);
        balanceOf[_dst] = add(balanceOf[_dst], _wad);
        emit Transfer(_src, _dst, _wad);
        return true;
    }

    /// @dev access: MINTER_ROLE
    function mint(address _usr, uint256 _wad) external override {
        balanceOf[_usr] = add(balanceOf[_usr], _wad);
        totalSupply = add(totalSupply, _wad);
        emit Transfer(address(0), _usr, _wad);
    }

    function burn(address _usr, uint256 _wad) external override {
        require(balanceOf[_usr] >= _wad, "FathomStablecoin/insufficient-balance");
        if (_usr != msg.sender && allowance[_usr][msg.sender] != uint256(-1)) {
            require(allowance[_usr][msg.sender] >= _wad, "FathomStablecoin/insufficient-allowance");
            allowance[_usr][msg.sender] = sub(allowance[_usr][msg.sender], _wad);
        }
        balanceOf[_usr] = sub(balanceOf[_usr], _wad);
        totalSupply = sub(totalSupply, _wad);
        emit Transfer(_usr, address(0), _wad);
    }

    function approve(address _usr, uint256 _wad) external override returns (bool) {
        allowance[msg.sender][_usr] = _wad;
        emit Approval(msg.sender, _usr, _wad);
        return true;
    }

    // --- Alias ---
    function push(address _usr, uint256 _wad) external {
        transferFrom(msg.sender, _usr, _wad);
    }

    function pull(address _usr, uint256 _wad) external {
        transferFrom(_usr, msg.sender, _wad);
    }

    function move(
        address _src,
        address _dst,
        uint256 _wad
    ) external {
        transferFrom(_src, _dst, _wad);
    }
}
