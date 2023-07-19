// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IStablecoin.sol";

contract FathomStablecoin is IStablecoin, AccessControlUpgradeable {
    bytes32 public constant OWNER_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // solhint-disable-next-line const-name-snakecase
    string public constant version = "1";
    // solhint-disable-next-line const-name-snakecase
    uint8 public constant decimals = 18;

    string public name; // Fathom USD Stablecoin
    string public symbol; // FUSD
    uint256 public totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function initialize(string memory _name, string memory _symbol) external initializer {
        AccessControlUpgradeable.__AccessControl_init();

        name = _name;
        symbol = _symbol;

        _setupRole(OWNER_ROLE, msg.sender);
    }

    function transfer(address _dst, uint256 _wad) external override returns (bool) {
        return transferFrom(msg.sender, _dst, _wad);
    }

    function mint(address _usr, uint256 _wad) external override {
        require(hasRole(MINTER_ROLE, msg.sender), "!minterRole");

        balanceOf[_usr] += _wad;
        totalSupply += _wad;
        emit Transfer(address(0), _usr, _wad);
    }

    function burn(address _usr, uint256 _wad) external override {
        require(balanceOf[_usr] >= _wad, "FathomStablecoin/insufficient-balance");
        if (_usr != msg.sender && allowance[_usr][msg.sender] != type(uint).max) {
            require(allowance[_usr][msg.sender] >= _wad, "FathomStablecoin/insufficient-allowance");
            allowance[_usr][msg.sender] -= _wad;
        }
        balanceOf[_usr] -= _wad;
        totalSupply -= _wad;
        emit Transfer(_usr, address(0), _wad);
    }

    function approve(address _usr, uint256 _wad) external override returns (bool) {
        _approve(msg.sender, _usr, _wad);
        return true;
    }

    function increaseAllowance(address _usr, uint256 _wad) external override returns (bool) {
        _approve(msg.sender, _usr, allowance[msg.sender][_usr] + _wad);
        return true;
    }

    function decreaseAllowance(address _usr, uint256 _wad) external override returns (bool) {
        uint256 currentAllowance = allowance[msg.sender][_usr];
        require(currentAllowance >= _wad, "FathomStablecoin/decreased-allowance-below-zero");
        _approve(msg.sender, _usr, currentAllowance - _wad);

        return true;
    }

    function push(address _usr, uint256 _wad) external {
        transferFrom(msg.sender, _usr, _wad);
    }

    function pull(address _usr, uint256 _wad) external {
        transferFrom(_usr, msg.sender, _wad);
    }

    function move(address _src, address _dst, uint256 _wad) external {
        transferFrom(_src, _dst, _wad);
    }

    function rename(string memory _name) external override {
        require(hasRole(OWNER_ROLE, msg.sender), "!OWNER_ROLE");
        name = _name;
        emit Rename(_name);
    }

    function transferFrom(address _src, address _dst, uint256 _wad) public override returns (bool) {
        require(_wad > 0, "FathomStablecoin/zero-amount");
        require(_dst != address(0), "FathomStablecoin/zero-destination");
        uint256 currentAllowance = allowance[_src][msg.sender];
        require(balanceOf[_src] >= _wad, "FathomStablecoin/insufficient-balance");
        if (_src != msg.sender && currentAllowance != type(uint).max) {
            require(currentAllowance >= _wad, "FathomStablecoin/insufficient-allowance");
            _approve(_src, msg.sender, currentAllowance - _wad);
        }
        balanceOf[_src] -= _wad;
        balanceOf[_dst] += _wad;
        emit Transfer(_src, _dst, _wad);
        return true;
    }

    function _approve(address _owner, address _spender, uint256 _amount) internal {
        require(_owner != address(0), "FathomStablecoin/approve-from-zero-address");
        require(_spender != address(0), "FathomStablecoin/approve-to-zero-address");

        allowance[_owner][_spender] = _amount;
        emit Approval(_owner, _spender, _amount);
    }
}
