pragma solidity ^0.4.7;

import "Token.sol";

contract Power {
    
    event Up(address indexed to, uint256 value);
    event Down(address indexed from, uint256 value);
    // code 5, forbidden operation
    event Error(address sender, uint code);

    // total amount of tokens
    uint256 public totalSupply = 0;
    address public minerAddress;
    address public aceAddress;

    mapping (address => uint256) balances;

    /// @param _holder The address from which the balance will be retrieved
    /// @return The balance
    function balanceOf(address _holder) constant returns (uint256 balance) {
        return balances[_holder];
    }
    
    function Power(address _minerAddress, address _aceAddress) {
        minerAddress = _minerAddress;
        aceAddress = _aceAddress;
    }

    function configure(address _minerAddress, address _aceAddress) {
        minerAddress = _minerAddress;
        aceAddress = _aceAddress;
    }
    
    // power up some ace to power
    function _up(address _owner, uint _amountAce) internal returns (bool success) {
        var ace = Token(aceAddress);
        if (totalSupply == 0) {
            totalSupply = ace.totalSupply();
        }

        uint amount = (_amountAce * totalSupply) / (ace.totalSupply() - _amountAce);
        if (totalSupply + amount <= totalSupply) {
            Error(msg.sender, 6);
            return false;
        }
        balances[_owner] += amount;
        totalSupply += amount;
        Up(_owner, amount);
        return true;
    }
    
    modifier onlyAce() {
        //checking access
        if (msg.sender == aceAddress) {
            _;
        } else {
            Error(msg.sender, 2);
        }
    }
    
    // this is a callback when ace is deposited into the account
    // if ace came from miner address, only increase acePerPower addr
    // else if ace came from other address, PowerUp that ace
    function notify(address _sender, uint _value) onlyAce returns (bool success) {
        if (_value <= 0) {
            Error(msg.sender, 5);
            return false;
        }
        if (_sender != minerAddress) {
            return _up(_sender, _value);
        }
        return true;
    }
    
    // power down some ace
    // this will call external contract
    function down(uint _amountPower) returns (bool success) {
        if (_amountPower <= 0) {
            Error(msg.sender, 5);
            return false;
        }
        if (balances[msg.sender] < _amountPower) {
            Error(msg.sender, 3);
            return false;
        }
        if (totalSupply - _amountPower > totalSupply) {
            Error(msg.sender, 4);
            return false;
        }
        var ace = Token(aceAddress);

        uint amountAce = (_amountPower * ace.totalSupply()) / totalSupply;
        if (ace.balanceOf(this) < amountAce) {
            Error(msg.sender, amountAce);
            return false;
        }
        balances[msg.sender] -= _amountPower;
        totalSupply -= _amountPower;
        Down(msg.sender, _amountPower);
        return ace.transfer(msg.sender, amountAce);
    }

}