pragma solidity ^0.4.8;

import "./Owned.sol";

contract AccountProxy is Owned {

  event Received (address indexed sender, uint value);

  /**
   * Default function; Gets called when Ether is deposited.
   */
  function() payable {
    Received(msg.sender, msg.value);
  }
  
  function forward(address _destination, uint _value, bytes _data) onlyOwner {
    if (_destination == 0) {
      assembly {
        // deploy a contract
        _destination := create(0,add(_data,0x20), mload(_data))
      }
    } else if (!_destination.call.value(_value)(_data)) { // send eth or data
        throw;
    }
  }
  
}
