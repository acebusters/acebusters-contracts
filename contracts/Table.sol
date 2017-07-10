pragma solidity ^0.4.11;

import './ERC20Basic.sol';
import './SafeMath.sol';

contract Table {
  using SafeMath for uint;

  event Join(address addr, uint256 amount);
  event NettingRequest(uint hand);
  event Netted(uint hand);
  event Leave(address addr);

  address public oracle;
  uint48 jozSb;
  address public tokenAddr;
  uint jozDecimals = 1000000000;
  
  bool public active = true;
  
  struct Hand {
    //in
    mapping (address => uint96) ins;
    //out
    uint claimCount;
    mapping (address => uint96) outs;
  }

  struct Seat {
    address senderAddr;
    uint48 amount;
    address signerAddr;
    uint32 exitHand;
  }
  
  Hand[] public hands;
  Seat[] public seats;

  uint32 public lastHandNetted;
  
  uint32 public lastNettingRequestHandId;
  uint public lastNettingRequestTime;
  
  function Table(address _token, address _oracle, uint _smallBlind, uint _seats) {
    tokenAddr = _token;
    oracle = _oracle;
    jozSb = uint48(_smallBlind.div(1000000000));
    seats.length = _seats;
    lastHandNetted = 1;
    lastNettingRequestHandId = 1;
    lastNettingRequestTime = now;
  }

  function smallBlind() constant returns (uint) {
    return jozDecimals.mul(uint256(jozSb));
  }
  
  function getLineup() constant returns (uint, address[] addresses, uint[] amounts, uint96[] exitHands) {
    addresses = new address[](seats.length);
    amounts = new uint[](seats.length);
    exitHands = new uint96[](seats.length);
    for (uint i = 0; i < seats.length; i++) {
        addresses[i] = seats[i].signerAddr;
        amounts[i] = seats[i].amount;
        exitHands[i] = seats[i].exitHand;
    }
    return (lastHandNetted, addresses, amounts, exitHands);
  }
  
  function getIn(uint96 _handId, address _addr) constant returns (uint96) {
    return hands[_handId].ins[_addr];
  }
  
  function getOut(uint96 _handId, address _addr) constant returns (uint96, uint) {
    return (hands[_handId].outs[_addr], hands[_handId].claimCount);
  }

  function inLineup(address _addr) constant returns (bool) {
    for (uint i = 0; i < seats.length; i++) {
      if (seats[i].signerAddr == _addr || seats[i].senderAddr == _addr) {
        return true;
      }
    }
    if (_addr == oracle) {
      return true;
    }
    return false;
  }
  
  function toggleActive(bytes _toggleReceipt) {
    uint32 handId;
    address dest;
    bytes32 r;
    bytes32 s;
    uint8 v;

    assembly {
      handId := mload(add(_toggleReceipt, 4))
      dest := mload(add(_toggleReceipt, 24))
      r := mload(add(_toggleReceipt, 56))
      s := mload(add(_toggleReceipt, 88))
      v := mload(add(_toggleReceipt, 89))
    }
    if (dest != address(this)) {
      throw;
    }
    
    if (lastHandNetted != handId) {
      throw;
    }
    
    if (ecrecover(sha3(handId, dest), v, r, s) != oracle) {
      throw;
    }

    active = !active;
  }
  
  // This function is called if all players agree to settle without dispute.
  // A list of changes to all balances is signed by all active players and submited.
  function settle(bytes _sigs, bytes32 _newBal1, bytes32 _newBal2) {
    // TODO: keeping track of who has signed,
    uint8 handsNetted = uint8(_newBal1 >> 232);

    // handId byte
    if (uint8(_newBal1 >> 224) != uint8(lastHandNetted)) {
      throw;
    }
    if (uint8(_newBal1 >> 240) != uint8(address(this))) {
      throw;
    }

    for (uint i = 0; i < _sigs.length / 65; i++) {
      uint8 v;
      bytes32 r;
      bytes32 s;
      assembly {
        v := mload(add(_sigs, add(1, mul(i, 65))))
        r := mload(add(_sigs, add(33, mul(i, 65))))
        s := mload(add(_sigs, add(65, mul(i, 65))))
      }
      if (!inLineup(ecrecover(sha3(_newBal1, _newBal2), v, r, s))) {
        throw;
      }
    }

    uint sumOfSeatBalances = 0;
    for (i = 0; i < seats.length; i++) {
      int48 diff;
      assembly {
        diff := calldataload(add(14, mul(i, 6)))
      }
      seats[i].amount = uint48(int48(seats[i].amount) + diff);
      sumOfSeatBalances += jozDecimals.mul(seats[i].amount);
    }

    lastHandNetted += handsNetted;
    Netted(lastHandNetted);
    _payout(sumOfSeatBalances);
  }

  function tokenFallback(address _from, uint _value, bytes _data) {
    assert(msg.sender == tokenAddr);
    // check the dough
    uint256 smallBlind = jozDecimals.mul(uint256(jozSb));
    if (40 * smallBlind > _value || _value > 400 * smallBlind) {
      throw;
    }

    uint8 pos;
    address signerAddr;
    assembly {
      pos := mload(add(_data, 1))
      signerAddr := mload(add(_data, 21))
    }
    assert(signerAddr != 0x0);

    bool rebuy = false;
    // avoid player joining multiple times
    for (uint i = 0; i < seats.length; i++ ) {
      if (seats[i].senderAddr == _from) {
        if (pos != i) {
          throw;
        }
        rebuy = true;
      }
    }

    if (rebuy) {
      // check the dough
      if (_value + seats[pos].amount > 400 * smallBlind) {
        throw;
      }
      // check exit hand
      if (seats[pos].exitHand > 0) {
        throw;
      }
      seats[pos].amount += uint48(_value.div(jozDecimals));
    } else {
      if (pos >=seats.length || seats[pos].amount > 0 || seats[pos].senderAddr != 0) {
        throw;
      }
      //seat player
      seats[pos].senderAddr = _from;
      seats[pos].amount = uint48(_value.div(jozDecimals));
      seats[pos].signerAddr = signerAddr;
    }
    Join(_from, _value);
  }
  
  function leave(bytes32 _r, bytes32 _s, bytes32 _pl) {
    uint8 v;
    uint56 dest;
    uint32 handId;
    address signer;

    assembly {
      v := calldataload(37)
      dest := calldataload(44)
      handId := calldataload(48)
      signer := calldataload(68)
    }
    if (dest != uint56(address(this))) {
      throw;
    }
    
    if (ecrecover(sha3(uint8(0), dest, handId, signer), v, _r, _s) != oracle) {
      throw;
    }

    uint pos = 99;
    for (uint i = 0; i < seats.length; i++) {
      if (seats[i].signerAddr == signer || seats[i].senderAddr == signer) {
        pos = i;
      }
    }
    if (pos == 99) {
      throw;
    }
    seats[pos].exitHand = handId;
    // create new netting request
    if (lastHandNetted < handId && lastNettingRequestHandId < handId) {
      NettingRequest(handId);
      lastNettingRequestHandId = handId;
      lastNettingRequestTime = now;
    }
    // TODO: remove player if lastHandNetted >= handId
  }

  function net() {
    netHelp(now);
  }
  
  function netHelp(uint _now) {
    if (_now  > lastNettingRequestTime + 60 * 10) {
      uint sumOfSeatBalances = 0;
      for (uint j = 0; j < seats.length; j++) {
        for (uint i = lastHandNetted + 1; i < lastNettingRequestHandId; i++ ) {
          int amount = int(seats[j].amount);
          amount += int(hands[i].outs[seats[j].signerAddr]) - int(hands[i].ins[seats[j].signerAddr]);
          seats[j].amount = uint48(amount);
        }
        sumOfSeatBalances += seats[j].amount;
      }
      lastHandNetted = lastNettingRequestHandId;
      Netted(lastHandNetted);
      _payout(sumOfSeatBalances);
    }
  }


  function _payout(uint sumOfSeatBalances) internal {
    var token = ERC20Basic(tokenAddr);
    uint totalBal = token.balanceOf(address(this));
    token.transfer(oracle, totalBal.sub(sumOfSeatBalances));

    for (uint i = 0; i < seats.length; i++) {
      Seat seat = seats[i];
      if (seat.exitHand > 0 && lastHandNetted >= seat.exitHand) {
        if (seat.amount > 0) {
          token.transfer(seat.senderAddr, seat.amount);
        }
        Leave(seat.senderAddr);
        delete seats[i];
      }
    }
  }

  function _storeDist(bytes _receipt) internal returns (uint) {
    //parse 
    uint handId;
    uint claimCount;
    address[] memory addr;
    uint96[] memory amount;
    assembly {
      handId := mload(add(_receipt, 36))
      claimCount := mload(add(_receipt, 68))
      //prepare loop
      let i := 0
      let len := mload(add(_receipt, 132))
      //create addr array
      addr := mload(0x40)
      mstore(addr, 0x20)
      addr := add(0x20, addr)
      mstore(addr, len)
      //create amount array
      amount := add(addr, mul(len, 0x20))
      mstore(amount, 0x20)
      amount := add(0x20, amount)
      mstore(amount, len)
      mstore(0x40, add(amount, and(add(mul(add(len, 1), 0x20), 0x1f), not(0x1f))))
      
      loop:
        jumpi(end, eq(i, len))
        {
          let elem := mload(add(_receipt, add(152, mul(i, 0x20))))
          mstore(add(addr, add(32, mul(i, 0x20))), elem)
          elem := mload(add(_receipt, add(164, mul(i, 0x20))))
          mstore(add(amount, add(32, mul(i, 0x20))), elem)
          i := add(i, 1)
        }
        jump(loop)
      end:
    }
    if (hands.length <= handId) {
      hands.length = handId + 1;
    }
    hands[handId].claimCount = uint128(claimCount);
    //todo: delete both arrays before?
    for (uint i = 0; i < addr.length; i ++) {
      hands[handId].outs[addr[i]] = amount[i];
    }
  }
  
  function submitDists(bytes _dists, bytes _sigs) returns (uint) {
    uint callPos = 0;
    uint writeCount = 0;
    for (uint elemPos = 0; elemPos < _sigs.length / 65; elemPos++) {
      uint handId;
      uint claimCount;
      bytes memory receipt;
      bytes32 r;
      bytes32 s;
      uint8 v;
      assembly {
        handId := mload(add(_dists, add(callPos, 36)))
        claimCount := mload(add(_dists, add(callPos, 68)))
        let len := add(mul(mload(add(_dists, add(callPos, 132))), 0x20), 132)
        
        //create bytes array
        receipt := add(0x20, mload(0x40))
        mstore(receipt, len)
        mstore(0x40, add(receipt, and(add(add(len, 0x20), 0x1f), not(0x1f))))

        calldatacopy(add(0x20, receipt), add(0x64, callPos), len)
        callPos := add(callPos, len)
        
        r := mload(add(_sigs, add(32, mul(elemPos, 65))))
        s := mload(add(_sigs, add(64, mul(elemPos, 65))))
        v := mload(add(_sigs, add(65, mul(elemPos, 65))))
      }
      if (ecrecover(sha3(receipt), v, r, s) != oracle)
          continue; //signed by oracle
      if (handId <= lastHandNetted)
          continue;
      if (handId < hands.length && claimCount <= hands[handId].claimCount)
          continue;
      _storeDist(receipt);
      writeCount++;
    }
    return writeCount;
  }
  
  function submitBets(bytes _bets, bytes _sigs) returns (uint) {
    uint writeCount = 0;
    for (uint elemPos = 0; elemPos < _sigs.length / 65; elemPos++) {
      uint32 name;
      uint handId;
      uint96 amount;
      bytes32 r;
      bytes32 s;
      uint8 v;
      assembly {
        name := mload(add(_bets, add(4, mul(elemPos, 68))))
        handId := mload(add(_bets, add(36, mul(elemPos, 68))))
        amount := mload(add(_bets, add(68, mul(elemPos, 68))))
        
        r := mload(add(_sigs, add(32, mul(elemPos, 65))))
        s := mload(add(_sigs, add(64, mul(elemPos, 65))))
        v := mload(add(_sigs, add(65, mul(elemPos, 65))))
      }
      //todo: implement to check name
      address signerAddr = ecrecover(sha3(bytes4(name), handId, uint(amount)), v, r, s);
      if (!inLineup(signerAddr)) {
        continue;
      }
      if (handId <= lastHandNetted || handId >= hands.length) {
        continue;
      }
      if (hands[handId].ins[signerAddr] >= amount) {
        continue;
      }
      hands[handId].ins[signerAddr] = amount;
      writeCount++;
    }
    return writeCount;
  }

}