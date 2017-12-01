pragma solidity ^0.4.11;

import "./Table.sol";
import "./Governable.sol";

contract TableFactory is Governable {

  address public tokenAddress;
  address public oracleAddress;
  uint256 public disputeTime;

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

  function configure(address _token, address _oracle, uint256 _disputeTime) onlyAdmins {
    assert(_token != 0x0 && _oracle != 0x0);
    tokenAddress = _token;
    oracleAddress = _oracle;
    disputeTime = _disputeTime;
  }

  function create(uint96 _smallBlind, uint _seats) onlyAdmins returns (address) {
    assert(_smallBlind != 0 && tokenAddress != 0x0 && oracleAddress != 0x0);
    assert(2 <= _seats && _seats <= 10);
    address table = new Table(tokenAddress, oracleAddress, _smallBlind, _seats, disputeTime);
    if (Table(table).active()) {
      uint pos = tables.length++;
      tables[pos] = table;
    }
  }

}
