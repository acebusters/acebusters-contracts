pragma solidity ^0.4.7;

// Implements ERC 20 Token standard: https://github.com/ethereum/EIPs/issues/20
// https://github.com/ethereum/EIPs/issues/20

contract Token {
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Issuance(address indexed to, uint256 value);
    event Revoke(address indexed from, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    // code 2, access denied
    // code 3, insuficient balance
    // code 4, int overflow
    // code 5, forbidden operation
    event Error(address sender, uint code);

    // total amount of tokens
    uint256 public totalSupply;
    uint96 public baseUnit;
    address public owner;
    
    mapping (address => uint256) balances;
    mapping (address => mapping (address => uint256)) allowed;

    /// @param _holder The address from which the balance will be retrieved
    /// @return The balance
    function balanceOf(address _holder) constant returns (uint256 balance) {
        return balances[_holder];
    }

    /// @param _holder The address of the account owning tokens
    /// @param _spender The address of the account able to transfer the tokens
    /// @return Amount of remaining tokens allowed to spent
    function allowance(address _holder, address _spender) constant returns (uint256 remaining) {
        return allowed[_holder][_spender];
    }
    
    
    function Token(address _owner, uint96 _baseUnit) {
        owner = _owner;
        baseUnit = _baseUnit;
    }
    
    modifier onlyOwner() {
        //checking access
        if (msg.sender == owner || owner == 0) {
            _;
        } else {
            Error(msg.sender, 2);
        }
    }
    
    modifier noEther() {
        if (msg.value > 0) throw;
        _;
    }
    
    // @param _owner The address of the board contract administrating this ledger
    function changeOwner(address _newOwner) onlyOwner noEther returns (bool success) {
        if (_newOwner == 0 || msg.sender == _newOwner || tx.origin == _newOwner) {
            Error(msg.sender, 5);
            return false;
        }
        owner = _newOwner;
        return true;
    }
    
    function issue(uint _value) onlyOwner noEther returns (bool success) {
        if (_value <= 0) {
            Error(msg.sender, 5);
            return;
        }
        if (totalSupply + _value <= totalSupply) {
            Error(msg.sender, 4);
            return;
        }
        balances[msg.sender] += _value;
        totalSupply += _value;
        Issuance(msg.sender, _value);
        return true;
    }
    
    function revoke(uint _value) onlyOwner noEther returns (bool success) {
        if (_value <= 0) {
            Error(msg.sender, 5);
            return;
        }
        if (balances[msg.sender] < _value) {
            Error(msg.sender, 3);
            return false;
        }
        if (totalSupply - _value > totalSupply) {
            Error(msg.sender, 4);
            return;
        }
        balances[msg.sender] -= _value;
        totalSupply -= _value;
        Revoke(msg.sender, _value);
        return true;
    }

    /// @notice send `_value` token to `_to` from `msg.sender`
    /// @param _to The address of the recipient
    /// @param _value The amount of token to be transferred
    /// @return Whether the transfer was successful or not
    function transfer(address _to, uint256 _value) noEther returns (bool success) {
        if (msg.sender == _to) {
            Error(msg.sender, 5);
            return false;
        }
        if (balances[_to] + _value < balances[_to]) {
            Error(msg.sender, 4);
            return false;
        }
        if (balances[msg.sender] >= _value && _value > 0) {
            balances[msg.sender] -= _value;
            balances[_to] += _value;
            Transfer(msg.sender, _to, _value);
            return true;
        }
        Error(msg.sender, 3);
        return false;
    }

    /// @notice send `_value` token to `_to` from `_from` on the condition it is approved by `_from`
    /// @param _from The address of the sender
    /// @param _to The address of the recipient
    /// @param _value The amount of token to be transferred
    /// @return Whether the transfer was successful or not
    function transferFrom(address _from, address _to, uint256 _value) noEther returns (bool success) {
        if (msg.sender == _from || _from == _to) {
            Error(msg.sender, 5);
            return false;
        }
        if (balances[_to] + _value < balances[_to]) {
            Error(msg.sender, 4);
            return false;
        }
        if (balances[_from] >= _value && allowed[_from][msg.sender] >= _value && _value > 0) {
            balances[_to] += _value;
            balances[_from] -= _value;
            allowed[_from][msg.sender] -= _value;
            Transfer(_from, _to, _value);
            return true;
        }
        Error(msg.sender, 3);
        return false;
    }

    /// @notice `msg.sender` approves `_addr` to spend `_value` tokens
    /// @param _spender The address of the account able to transfer the tokens
    /// @param _value The amount of wei to be approved for transfer
    /// @return Whether the approval was successful or not
    function approve(address _spender, uint256 _value) noEther returns (bool success) {
        if (msg.sender == _spender) {
            Error(msg.sender, 5);
            return false;
        }
        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
        return true;
    }

}