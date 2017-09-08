pragma solidity ^0.4.11;

contract AccountProxy {

  event Deposit(address indexed sender, uint value);
  event Withdrawal(address indexed to, uint value, bytes data);

  // onwer of contract
  address owner;
  // this address can sign receipt to unlock account
  address lockAddr;

  function AccountProxy(address _owner, address _lockAddr) {
    owner = _owner;
    lockAddr = _lockAddr;
  }

  function isLocked() constant returns (bool) {
    return lockAddr != 0x0;
  }

  function getOwner() constant returns (address) {
    return owner;
  }




  // ############################################
  // ###########  OWNER FUNCTIONS ###############
  // ############################################

  modifier onlyOwner() {
    if (msg.sender == owner) {
      _;
    }
  }

  function transfer(address _newOwner) onlyOwner {
    owner = _newOwner;
  }

  function forward(address _destination, uint _value, bytes _data) onlyOwner {
    if (_destination == 0) {
      assembly {
        // deploy a contract
        _destination := create(0,add(_data,0x20), mload(_data))
      }
    } else {
      assert(_destination.call.value(_value)(_data)); // send eth or data
      if (_value > 0) {
        Withdrawal(_destination, _value, _data);
      }
    }
  }





  // ############################################
  // ###########  ADMIN FUNCTIONS ###############
  // ############################################

  function unlock(bytes32 _r, bytes32 _s, bytes32 _pl) {
    assert(lockAddr != 0x0);
    // parse receipt data
    uint8 v;
    uint88 target;
    address newOwner;
    assembly {
        v := calldataload(37)
        target := calldataload(48)
        newOwner := calldataload(68)
    }
    // check permission
    assert(target == uint88(address(this)));
    assert(newOwner == msg.sender);
    assert(newOwner != owner);
    assert(ecrecover(sha3(uint8(0), target, newOwner), v, _r, _s) == lockAddr);
    // update state
    owner = newOwner;
    lockAddr = 0x0;
  }





  // ############################################
  // ########### PUBLIC FUNCTIONS ###############
  // ############################################

  /**
   * Default function; is called when Ether is deposited.
   */
  function() payable {
    // if locked, only allow 0.1 ETH max
    assert(lockAddr == 0x0 || this.balance <= 1e17);
    Deposit(msg.sender, msg.value);
  }

  /**
   * Default function; is called when ERC223 token is deposited.
   */
  function tokenFallback(address _from, uint _value, bytes _data) {
  }

}
