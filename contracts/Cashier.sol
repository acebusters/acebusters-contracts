pragma solidity ^0.4.7;
import "Token.sol";

contract Cashier {
    Token token;
    
    event Announced(bytes32 indexed sh3, address to);
    event Claimed(bytes32 indexed sh3, address from, uint256 amount);
    
    //0: bad parameters
    //1: insufficient balance
    //2: operation not allowed
    //3: permission denied
    //4: not found
    //5: transfer failed
    event Error(address sender, uint code);
    
    mapping (bytes32 => address) public announced;
    mapping (bytes32 => bool) public claimed;

    address public owner;

    modifier onlyOwner() {
        //checking access
        if (msg.sender == owner || owner == 0) {
            _;
        } else {
            Error(msg.sender, 3);
        }
    }
    
    modifier noEther() {
        if (msg.value == 0) {
            _;
        } else {
            Error(msg.sender, 2);
        }
    }

    function Cashier(address _owner, address _token) {
        owner = _owner;
        token = Token(_token);
    }
    
    function changeOwner(address _newOwner) onlyOwner noEther returns (bool success) {
        if (_newOwner == 0 || msg.sender == _newOwner || tx.origin == _newOwner) {
            Error(msg.sender, 5);
            return false;
        }
        owner = _newOwner;
        return true;
    }
    
    function setToken(address _token) onlyOwner noEther returns (bool success) {
        if (_token == 0) {
            Error(msg.sender, 5);
            return false;
        }
        token = Token(_token);
        return true;
    }
    
    function announce(bytes32 _sha3) noEther returns (bool success) {
        if (_sha3 == 0) {
            Error(msg.sender, 0);
            return false;
        }
        if (claimed[_sha3] == true || announced[_sha3] != 0) {
            Error(msg.sender, 2);
            return false;
        }
        announced[_sha3] = msg.sender;
        Announced(_sha3, msg.sender);
    }
    
    function claim(bytes _fulfillment) noEther returns (bool success) {
        uint32 name;
        address sig;
        uint96 nonce;
        uint256 amount;
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            name := mload(add(_fulfillment, 4))
            sig := mload(add(_fulfillment, 24))
            nonce := mload(add(_fulfillment, 36))
            amount := mload(add(_fulfillment, 68))
            r := mload(add(_fulfillment, 100))
            s := mload(add(_fulfillment, 132))
            v := mload(add(_fulfillment, 133))
        }

        bytes32 sh3 = sha3(bytes4(name), sig, uint96(nonce), amount);
        address signer = ecrecover(sh3, v, r, s);
        if (signer != owner || announced[sh3] == 0) {
            Error(signer, 3);
            return false;
        }
        
        if (claimed[sh3] == true) {
            Error(msg.sender, 2);
            return false;
        }
        
        if (amount == 0) {
            Error(msg.sender, 4);
            return false;
        }

        uint256 balance = token.balanceOf(this);
        if (amount > balance) {
            Error(signer, 1);
            return false;
        }

        delete announced[sh3];
        claimed[sh3] = true;
        if (!token.transfer(msg.sender, amount)) {
            Error(msg.sender, 5);
            return false;
        }
        Claimed(sh3, signer, amount);
    }

}