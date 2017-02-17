pragma solidity ^0.4.7;

contract Owned {

  address public owner;

  modifier onlyOwner() {
    if (msg.sender == owner) {
      _;
    }
  }

  modifier ifOwner(address _sender) {
    if(_sender == owner) {
      _;
    }
  }

  function isOwner(address _addr) constant returns(bool) {
    return _addr == owner;
  }

  function Owned() {
    owner = msg.sender;
  }

  function transfer(address _newOwner) onlyOwner {
    owner = _newOwner;
  }

}
