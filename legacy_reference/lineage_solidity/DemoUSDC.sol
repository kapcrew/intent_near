// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Test-only 6-decimal stablecoin for the XDC Apothem demo.
/// @dev NOT FOR PRODUCTION. Anyone may claim a one-time faucet allocation.
contract DemoUSDC {
    string public constant name = "Intent Demo USD";
    string public constant symbol = "dUSDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    uint256 public constant FAUCET_AMOUNT = 1_000 * 1e6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public faucetClaimed;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event FaucetClaimed(address indexed account, uint256 amount);

    function faucet() external {
        require(!faucetClaimed[msg.sender], "FAUCET_ALREADY_CLAIMED");
        faucetClaimed[msg.sender] = true;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "INSUFFICIENT_ALLOWANCE");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ZERO_ADDRESS");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ZERO_ADDRESS");
        require(balanceOf[from] >= amount, "INSUFFICIENT_BALANCE");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}
