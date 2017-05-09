pragma solidity ^0.4.8;

import "./Table.sol";
import "./Owned.sol";

contract TableFactory is Owned {

  address public tokenAddress;
  address public oracleAddress;
    
  address[] public tables;
  
  function getTables() constant returns (address[]) {
    uint activeCount = 0;
    for (uint i = 0; i < tables.length; i++ ) {
      if (Table(tables[i]).active()) {
        activeCount++;
      }
    }
    address[] memory rv = new address[](activeCount);
    activeCount = 0;
    for (i = 0; i < tables.length; i++ ) {
      if (Table(tables[i]).active()) {
        rv[activeCount] = tables[i];
        activeCount++;
      }
    }
    return rv;
  }
  
  function configure(address _token, address _oracle) onlyOwner {
    if (_token == 0x0 || _oracle == 0x0) {
      throw;
    }
    tokenAddress = _token;
    oracleAddress = _oracle;
  }

  function create(uint96 _smallBlind, uint _seats) onlyOwner returns (address) {
    if (_smallBlind == 0) {
      throw;
    }
    if (_seats < 2 || _seats > 10) {
      throw;
    }
    address table = new Table(tokenAddress, oracleAddress, _smallBlind, _seats);
    if (Table(table).active()) {
      uint pos = tables.length++;
      tables[pos] = table;
    }
  }

}
