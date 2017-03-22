pragma solidity ^0.4.8;

import "./Owned.sol";

contract AccountProxy is Owned {

  event Received (address indexed sender, uint value);

  function () payable {
      if (msg.value > 0) {
        Received(msg.sender, msg.value);
      }
  }

  function send(address destination, uint value) onlyOwner {
    if (destination == 0) {
        throw;
    }
    if (!destination.send(value)) {
        throw;
    }
  }
  
  function forward(address destination, bytes data) onlyOwner {
    if (destination == 0) {
        throw;
    }
    if (!destination.call(data)) {
        throw;
    }
  }
}
