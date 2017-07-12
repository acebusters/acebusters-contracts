pragma solidity ^0.4.11;

import './ERC20Basic.sol';
import './SafeMath.sol';

contract Table {
  using SafeMath for uint;

  event Join(address indexed addr, uint256 amount);
  event NettingRequest(uint256 hand);
  event Netted(uint256 hand);
  event Leave(address addr);

  address public oracle;
  uint256 sb;
  address public tokenAddr;
  uint256 jozDecimals = 1000000000;
  
  bool public active = true;
  
  struct Hand {
    //in
    mapping (address => uint256) ins;
    //out
    uint claimCount;
    mapping (address => uint256) outs;
  }

  struct Seat {
    address senderAddr;
    uint256 amount;
    address signerAddr;
    uint256 exitHand;
  }
  
  Hand[] public hands;
  Seat[] public seats;

  uint32 public lastHandNetted;
  
  uint32 public lastNettingRequestHandId;
  uint public lastNettingRequestTime;
  
  function Table(address _token, address _oracle, uint _smallBlind, uint _seats) {
    tokenAddr = _token;
    oracle = _oracle;
    sb = _smallBlind;
    seats.length = _seats;
    hands.length = 4;
    lastHandNetted = 1;
    lastNettingRequestHandId = 1;
    lastNettingRequestTime = now;
  }

  function smallBlind() constant returns (uint256) {
    return sb;
  }
  
  function getLineup() constant returns (uint256, address[] addresses, uint256[] amounts, uint256[] exitHands) {
    addresses = new address[](seats.length);
    amounts = new uint256[](seats.length);
    exitHands = new uint256[](seats.length);
    for (uint i = 0; i < seats.length; i++) {
        addresses[i] = seats[i].signerAddr;
        amounts[i] = seats[i].amount;
        exitHands[i] = seats[i].exitHand;
    }
    return (lastHandNetted, addresses, amounts, exitHands);
  }
  
  function getIn(uint256 _handId, address _addr) constant returns (uint256) {
    return hands[_handId].ins[_addr];
  }
  
  function getOut(uint256 _handId, address _addr) constant returns (uint256, uint) {
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
    assert(uint8(_newBal1 >> 224) == uint8(lastHandNetted));
    assert(uint8(_newBal1 >> 240) == uint8(address(this)));

    for (uint i = 0; i < _sigs.length / 65; i++) {
      uint8 v;
      bytes32 r;
      bytes32 s;
      assembly {
        v := mload(add(_sigs, add(1, mul(i, 65))))
        r := mload(add(_sigs, add(33, mul(i, 65))))
        s := mload(add(_sigs, add(65, mul(i, 65))))
      }
      assert(inLineup(ecrecover(sha3(_newBal1, _newBal2), v, r, s)));
    }

    uint256 sumOfSeatBalances = 0;
    for (i = 0; i < seats.length; i++) {
      int48 diff;
      assembly {
        diff := calldataload(add(14, mul(i, 6)))
      }
      seats[i].amount = uint256(int256(seats[i].amount) + (int256(jozDecimals) * diff));
      sumOfSeatBalances += seats[i].amount;
    }

    lastHandNetted += handsNetted;
    Netted(lastHandNetted);
    _payout(sumOfSeatBalances);
  }

  function tokenFallback(address _from, uint256 _value, bytes _data) {
    assert(msg.sender == tokenAddr);
    // check the dough
    if (40 * sb > _value || _value > 400 * sb) {
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
      if (_value + seats[pos].amount > 400 * sb) {
        throw;
      }
      // check exit hand
      if (seats[pos].exitHand > 0) {
        throw;
      }
      seats[pos].amount += _value;
    } else {
      if (pos >=seats.length || seats[pos].amount > 0 || seats[pos].senderAddr != 0) {
        throw;
      }
      //seat player
      seats[pos].senderAddr = _from;
      seats[pos].amount = _value;
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
    assert(dest == uint56(address(this)));
    
    assert(ecrecover(sha3(uint8(0), dest, handId, signer), v, _r, _s) == oracle);

    uint pos = seats.length;
    for (uint i = 0; i < seats.length; i++) {
      if (seats[i].signerAddr == signer || seats[i].senderAddr == signer) {
        pos = i;
      }
    }
    assert(pos < seats.length);
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
    //token.transfer(oracle, totalBal.sub(sumOfSeatBalances));

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

  function submit(bytes32[] _data) returns (uint) {
    uint next = 0;

    while (next + 3 <= _data.length) {
      uint8 v;
      uint24 dest;
      uint32 handId;
      uint8 t;        // type of receipt
      bytes31 rest;
      uint48 amount;
      address signer;
      assembly {
        let f := mul(add(next, 3), 32)
        v := calldataload(add(f, 5))
        dest := calldataload(add(f, 8))
        handId := calldataload(add(f, 12))
        t := calldataload(add(f, 13))
        rest := calldataload(add(f, 37))
      }
      //assert(dest == uint24(address(this)));
      if (hands.length <= handId) {
        hands.length++;
        // hands.length = handId + 1;
      }
      // the receipt is a distribution
      if (t == 21) {
        signer = ecrecover(sha3(uint8(0), rest, _data[next+3]), v, _data[next], _data[next+1]);
        //assert(signer == oracle && handId < hands.length);
        assembly {
          v := mul(add(next, 3), 32)
          t := calldataload(add(v, 14))
        }
        if (t > hands[handId].claimCount || hands[handId].claimCount == 0) {
          hands[handId].claimCount = t;
          for (dest = 0; dest < 7; dest++) {
            assembly {
              t := calldataload(add(v, add(mul(dest, 7), 16)))
              amount := calldataload(add(v, add(mul(dest, 7), 22)))
            }
            if (amount == 0) {
                break;
            }
            hands[handId].outs[seats[t].signerAddr] = jozDecimals.mul(amount);
          }
        }
        next = next + 4;
      // the receipt is a bet/check/flop
      } else {
        signer = ecrecover(sha3(uint8(0), rest), v, _data[next], _data[next+1]);
        //assert(inLineup(signer));
        assert(lastHandNetted < handId  && handId < hands.length);
        assembly {
          amount := calldataload(add(mul(add(next, 3), 32), 19))
        }
        uint256 value = jozDecimals.mul(amount);
        if (value > hands[handId].ins[signer]) {
          hands[handId].ins[signer] = value;
        }
        next = next + 3;
      }
    }
  }

}