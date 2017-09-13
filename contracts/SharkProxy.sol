pragma solidity ^0.4.11;

contract SharkProxy {

  event Deposit(address indexed sender, uint256 value);
  event Withdrawal(address indexed to, uint256 value, bytes data);

  address owner;

  function SharkProxy() {
    owner = msg.sender;
  }

  function getOwner() constant returns (address) {
    return owner;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param _newOwner The address to transfer ownership to.
   */
  function transfer(address _newOwner) onlyOwner {
    require(_newOwner != address(0)); 
    owner = _newOwner;
  }

  function forward(address _destination, uint256 _value, bytes _data) onlyOwner {
    require(_destination != address(0));
    assert(_destination.call.value(_value)(_data)); // send eth and/or data
    if (_value > 0) {
      Withdrawal(_destination, _value, _data);
    }
  }

  /**
   * Default function; is called when Ether is deposited.
   */
  function() payable {
    Deposit(msg.sender, msg.value);
  }

  /**
   * @dev is called when ERC223 token is deposited.
   */
  function tokenFallback(address _from, uint _value, bytes _data) {
  }

}
