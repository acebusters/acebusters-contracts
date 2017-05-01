pragma solidity ^0.4.8;

import "./Owned.sol";

contract AccountProxy is Owned {

  event Received (address indexed sender, uint value);

  // Address to which any funds sent to this contract will be forwarded
  address tokenAddress;

  /**
   * Default function; Gets called when Ether is deposited,
   * and forwards it to the destination address.
   */
  function() payable {
    if (tokenAddress != 0) {
      if (!tokenAddress.send(msg.value)) {
        throw;
      }
    } else {
      if (msg.value > 0) {
        Received(msg.sender, msg.value);
      }
    }
  }

  function send(address _destination, uint _value) onlyOwner {
    // throw if destination not valid
    if (_destination == 0) {
        throw;
    }
    // unset tokenAddress by sending to itself
    if (_destination == address(this)) {
      tokenAddress = 0x0;
      return;
    }
    // set tokenAddress by sending 0 value
    if (_value == 0) {
      tokenAddress = _destination;
      return;
    }
    if (!_destination.send(_value)) {
        throw;
    }
  }
  
  function forward(address _destination, bytes _data) onlyOwner {
    if (_destination == 0) {
        throw;
    }
    if (!_destination.call(_data)) {
        throw;
    }
  }
}
