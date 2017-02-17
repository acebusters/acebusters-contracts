pragma solidity ^0.4.7;

import "Owned.sol";

contract Proxy is Owned {

  event Created (address indexed destination);
  event Received (address indexed sender, uint value);

  function () payable {
      if (msg.value > 0) {
        Received(msg.sender, msg.value);
      }
  }

  function forward(address destination, uint value, bytes data) onlyOwner {
    if (destination == 0){
        assembly {
            destination := create(0, add(data,0x20), mload(data))
        }
        Created(destination);
    } else {
        bool isSuccess = destination.call.value(value)(data);
        if (!isSuccess) {
            throw;
        }
    }
  }
}
