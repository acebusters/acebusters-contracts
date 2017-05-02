pragma solidity ^0.4.8;

import './SafeMath.sol';

contract NutzMock {
  using SafeMath for uint;

  mapping(address => uint) balances;
  
  // the Token sale mechanism parameters:
  uint public ceiling;
  uint public floor;

  // returns balance
  function balanceOf(address _owner) constant returns (uint) {
    return balances[_owner];
  }

  function NutzMock(address initialAccount, uint initialBalance) {
      // initial price at 1000 Wei / token
      ceiling = 1000;
      // initial floor at 1000 Wei / token
      floor = 1000;
      balances[initialAccount] = initialBalance;
  }
    
  function () payable {
    purchaseTokens();
  }
  
  function purchaseTokens() payable {
    if (msg.value == 0) {
      return;
    }
    uint amountToken = msg.value.div(ceiling);
    // avoid deposits that issue nothing
    // might happen with very large ceiling
    if (amountToken == 0) {
      throw;
    }
    balances[msg.sender] = balances[msg.sender].add(amountToken);
  }

  /*
   * Fix for the ERC20 short address attack  
   */
  modifier onlyPayloadSize(uint size) {
     if(msg.data.length < size + 4) {
       throw;
     }
     _;
  }

  function transfer(address _to, uint _value) onlyPayloadSize(2 * 32) {
    if (_to == address(this) || _value == 0) {
      throw;
    }
    balances[msg.sender] = balances[msg.sender].sub(_value);
    balances[_to] = balances[_to].add(_value);
  }

}
