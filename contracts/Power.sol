pragma solidity ^0.4.7;

import "Token.sol";

contract Power {
    
    event Up(address indexed to, uint256 value);
    event Down(address indexed from, uint256 value);
    // code 5, forbidden operation
    event Error(address sender, uint code);

    // total amount of tokens
    uint public totalSupply;
    uint public downtime;
    address public minerAddress;
    address public aceAddress;

    mapping (address => uint256) balances;

    struct DownRequest {
        address owner;
        uint total;
        uint left;
        uint start;
    }

    DownRequest[] downs;

    /// @param _holder The address from which the balance will be retrieved
    /// @return The balance
    function balanceOf(address _holder) constant returns (uint256 balance) {
        return balances[_holder];
    }
    
    function Power(address _minerAddress, address _aceAddress, uint _downtime) {
        minerAddress = _minerAddress;
        aceAddress = _aceAddress;
        downtime = _downtime;
    }

    function configure(address _minerAddress, address _aceAddress, uint _downtime) {
        minerAddress = _minerAddress;
        aceAddress = _aceAddress;
        downtime = _downtime;
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

    // executes a powerdown request
    function _downTick(uint _pos, uint _now) internal returns (bool success) {
        if (downs.length <= _pos) {
            Error(msg.sender, 7);
            return false;
        }
        if (_now <= downs[_pos].start) {
            Error(msg.sender, 8);
            return false;
        }
        uint expected = downs[_pos].total - downs[_pos].total * ((_now - downs[_pos].start) / downtime);
        if (downs[_pos].left <= expected) {
            Error(msg.sender, 9);
            return false;
        }
        uint amountPower = downs[_pos].left - expected;
        if (amountPower <= 0) {
            Error(downs[_pos].owner, 5);
            return false;
        }
        if (balances[downs[_pos].owner] < amountPower) {
            Error(downs[_pos].owner, 3);
            return false;
        }
        if (totalSupply - amountPower > totalSupply) {
            Error(downs[_pos].owner, 4);
            return false;
        }
        var ace = Token(aceAddress);

        uint amountAce = (amountPower * ace.totalSupply()) / totalSupply;
        if (ace.balanceOf(this) < amountAce) {
            Error(downs[_pos].owner, 9);
            return false;
        }
        balances[downs[_pos].owner] -= amountPower;
        totalSupply -= amountPower;
        downs[_pos].left = expected;
        if (!ace.transfer(downs[_pos].owner, amountAce)) {
            // revert all changes to account;
            balances[downs[_pos].owner] += amountPower;
            totalSupply += amountPower;
            downs[_pos].left = expected + amountPower;
        }
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

    // registers a powerdown request
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

        uint pos = downs.length++;
        downs[pos] = DownRequest(msg.sender, _amountPower, _amountPower, now);
        Down(msg.sender, _amountPower);
        return true;
    }

    function downTick(uint _pos) returns (bool success) {
        return _downTick(_pos, now);
    }

// !!!!!!!!!!!!!!!!!!!!!!!! IMPORTANT !!!!!!!!!!!!!!!!!!!!!
// REMOVE THIS BEFORE DEPLOYMENT!!!!
// needed for accelerated time testing
    function downTickTest(uint _pos, uint _now) returns (bool success) {
        return _downTick(_pos, _now);
    }
// !!!!!!!!!!!!!!!!!!!!!!!! IMPORTANT !!!!!!!!!!!!!!!!!!!!!

}