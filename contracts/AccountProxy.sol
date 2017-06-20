pragma solidity ^0.4.8;

import "./Owned.sol";

contract AccountProxy is Owned {

  event Deposit(address indexed sender, uint value);
  event Withdrawal(address indexed to, uint value, bytes data);

  /**
   * Default function; is called when Ether is deposited.
   */
  function() payable {
    Deposit(msg.sender, msg.value);
  }
  
  function forward(address _destination, uint _value, bytes _data) onlyOwner {
    if (_destination == 0) {
      assembly {
        // deploy a contract
        _destination := create(0,add(_data,0x20), mload(_data))
      }
    } else {
      if (!_destination.call.value(_value)(_data)) { // send eth or data
        throw;
      }
      if (_value > 0) {
        Withdrawal(_destination, _value, _data);
      }
    }
  }
  
}
