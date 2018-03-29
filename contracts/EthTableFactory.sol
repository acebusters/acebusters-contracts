pragma solidity ^0.4.11;

import "./SnGTable.sol";
import "./Governable.sol";

contract EthTableFactory is Governable {

  address public tokenAddress;
  address public oracleAddress;
  uint256 public disputeTime;

  address[] public tables;

  function getTables() constant returns (address[]) {
    uint activeCount = 0;
    for (uint i = 0; i < tables.length; i++ ) {
      if (SnGTable(tables[i]).active()) {
        activeCount++;
      }
    }
    address[] memory rv = new address[](activeCount);
    activeCount = 0;
    for (i = 0; i < tables.length; i++ ) {
      if (SnGTable(tables[i]).active()) {
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

  function create(uint96 _minBuyIn, uint _seats, uint256 _coolOffPeriod,
                  uint256 _registrationPeriod, uint256 _blindLevelDuration,
                  uint16[] _blindStructure) onlyAdmins returns (address
  ) {
    assert(_minBuyIn != 0 && tokenAddress != 0x0 && oracleAddress != 0x0);
    assert(2 <= _seats && _seats <= 10);
    address table = new SnGTable(oracleAddress, _minBuyIn, _seats, disputeTime,
                                 _coolOffPeriod, _registrationPeriod,
                                 _blindLevelDuration, _blindStructure);
    if (SnGTable(table).active()) {
      uint pos = tables.length++;
      tables[pos] = table;
    }
  }

}
