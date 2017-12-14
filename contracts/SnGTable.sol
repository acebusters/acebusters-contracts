pragma solidity ^0.4.11;

import './ERC20Basic.sol';
import './Ownable.sol';
import './SafeMath.sol';

contract SnGTable is Ownable {
  using SafeMath for uint;

  event Join(address indexed addr, uint256 amount);
  event NettingRequest(uint256 hand);
  event Netted(uint256 hand);
  event Leave(address addr);

  enum TableState { CoolOff, Registration, Tournament}
  TableState public state;

  address public oracle;
  uint256 sb;
  uint256 public restartTime;
  uint256 public coolOffPeriod;
  uint256 public registrationPeriod;
  address public tokenAddr;
  uint256 jozDecimals = 1000000000;

  bool public active = true;

  struct Hand {
    //in
    mapping (address => uint256) ins;
    //out
    uint256 claimCount;
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
  uint256 public lastNettingRequestTime;
  uint8 internal totalPlayers;
  uint256 disputeTime;

  function SnGTable(address _oracle, uint256 _smallBlind, uint256 _seats, uint256 _disputeTime, uint256 _coolOffPeriod, uint256 _registrationPeriod) {
    oracle = _oracle;
    sb = _smallBlind;
    seats.length = _seats;
    lastHandNetted = 1;
    lastNettingRequestHandId = 1;
    lastNettingRequestTime = now;
    disputeTime = _disputeTime;
    coolOffPeriod = _coolOffPeriod;
    registrationPeriod = _registrationPeriod;
    restartTime = now;
    state = TableState.CoolOff;
  }

  modifier isState(TableState _state) {
    require(state == _state);
    _;
  }

  function tick() public {
    var (, , , , activePlayers) = getLineup();
    if (state == TableState.CoolOff && now >= restartTime.add(coolOffPeriod)) {
      state = TableState.Registration;
    } else if (state == TableState.Registration && now >= restartTime.add(coolOffPeriod).add(registrationPeriod) && activePlayers >= 6) {
      state = TableState.Tournament;
    } else if (state == TableState.Tournament && activePlayers == 0) {
      state = TableState.CoolOff;
      restartTime = now;
    } else {
      revert();
    }
  }

  function smallBlind() constant returns (uint256) {
    return sb;
  }

  function getLineup() constant returns (uint256, address[] addresses, uint256[] amounts, uint256[] exitHands, uint8 activePlayers) {
    addresses = new address[](seats.length);
    amounts = new uint256[](seats.length);
    exitHands = new uint256[](seats.length);
    activePlayers = 0;
    for (uint256 i = 0; i < seats.length; i++) {
        addresses[i] = seats[i].signerAddr;
        amounts[i] = seats[i].amount;
        exitHands[i] = seats[i].exitHand;
        if (amounts[i] != 0) {
          activePlayers++ ;
        }
    }
    return (lastHandNetted, addresses, amounts, exitHands, activePlayers);
  }

  function getIn(uint256 _handId, address _addr) constant isState(TableState.Tournament) returns (uint256) {
    return hands[_handId].ins[_addr];
  }

  function getOut(uint256 _handId, address _addr) constant isState(TableState.Tournament) returns (uint256, uint) {
    return (hands[_handId].outs[_addr], hands[_handId].claimCount);
  }

  function inLineup(address _addr) constant isState(TableState.Tournament) returns (bool) {
    for (uint256 i = 0; i < seats.length; i++) {
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
    require(dest == address(this));
    require(lastHandNetted == handId);
    require(ecrecover(sha3(handId, dest), v, r, s) == oracle);

    active = !active;
  }

  // Join
  function join (bytes _data) public isState(TableState.Registration) payable {
    // check the dough
    require(40 * sb <= msg.value && msg.value <= 400 * sb);

    uint8 pos;
    address signerAddr;
    assembly {
      pos := mload(add(_data, 1))
      signerAddr := mload(add(_data, 21))
    }
    require(signerAddr != 0x0);

    bool rebuy = false;
    // avoid player joining multiple times
    for (uint256 i = 0; i < seats.length; i++ ) {
      if (seats[i].senderAddr == msg.sender) {
        require(pos == i);
        rebuy = true;
      }
    }

    if (rebuy) {
      // check the dough
      require(msg.value + seats[pos].amount <= sb.mul(400));
      // check exit hand
      require(seats[pos].exitHand == 0);
      seats[pos].amount += msg.value;
    } else {
      if (pos >=seats.length || seats[pos].amount > 0 || seats[pos].senderAddr != 0) {
        revert();
      }
      //seat player
      seats[pos].senderAddr = msg.sender;
      seats[pos].amount = msg.value;
      seats[pos].signerAddr = signerAddr;
    }
    Join(msg.sender, msg.value);
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
    require(dest == uint56(address(this)));

    require(ecrecover(sha3(uint8(0), dest, handId, signer), v, _r, _s) == oracle);

    uint256 pos = seats.length;
    for (uint256 i = 0; i < seats.length; i++) {
      if (seats[i].signerAddr == signer || seats[i].senderAddr == signer) {
        pos = i;
      }
    }
    require(pos < seats.length);
    require(seats[pos].exitHand == 0);
    seats[pos].exitHand = handId;
    // create new netting request

    if (lastHandNetted < handId) {
      if (lastNettingRequestHandId < handId) {
        NettingRequest(handId);
        lastNettingRequestHandId = handId;
        lastNettingRequestTime = now;
      }
    } else {
      _payout(0);
    }
  }

  // This function is called if all players agree to settle without dispute.
  // A list of changes to all balances is signed by all active players and submited.
  function settle(bytes _sigs, bytes32 _newBal1, bytes32 _newBal2) isState(TableState.Tournament) {
    // TODO: keeping track of who has signed,
    uint8 handsNetted = uint8(_newBal1 >> 232);
    require(handsNetted > 0);

    // handId byte
    require(uint8(_newBal1 >> 224) == uint8(lastHandNetted));
    require(uint8(_newBal1 >> 240) == uint8(address(this)));

    for (uint256 i = 0; i < _sigs.length / 65; i++) {
      uint8 v;
      bytes32 r;
      bytes32 s;
      assembly {
        v := mload(add(_sigs, add(1, mul(i, 65))))
        r := mload(add(_sigs, add(33, mul(i, 65))))
        s := mload(add(_sigs, add(65, mul(i, 65))))
      }
      require(inLineup(ecrecover(sha3(_newBal1, _newBal2), v, r, s)));
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

  function submit(bytes32[] _data) returns (uint writeCount) {
    uint256 next = 0;
    writeCount = 0;

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
      require(dest == uint24(address(this)));
      if (hands.length <= lastNettingRequestHandId) {
        hands.length = lastNettingRequestHandId + 1;
      }
      // the receipt is a distribution
      if (t == 21) {
        signer = ecrecover(sha3(uint8(0), rest, _data[next+3]), v, _data[next], _data[next+1]);
        require(signer == oracle && handId < hands.length);
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
            writeCount++;
          }
        }
        next = next + 4;
      // the receipt is a bet/check/fold
      } else {
        signer = ecrecover(sha3(uint8(0), rest), v, _data[next], _data[next+1]);
        require(inLineup(signer));
        require(lastHandNetted < handId  && handId < hands.length);
        assembly {
          amount := calldataload(add(mul(add(next, 3), 32), 19))
        }
        uint256 value = jozDecimals.mul(amount);
        if (value > hands[handId].ins[signer]) {
          hands[handId].ins[signer] = value;
          writeCount++;
        }
        next = next + 3;
      }
    }
  }


  function net() isState(TableState.Tournament) {
    require(now  >= lastNettingRequestTime + disputeTime);
    uint256 sumOfSeatBalances = 0;
    for (uint256 j = 0; j < seats.length; j++) {
      Seat storage seat = seats[j];
      for (uint256 i = lastHandNetted + 1; i <= lastNettingRequestHandId; i++ ) {
        seat.amount = seat.amount.add(hands[i].outs[seat.signerAddr]).sub(hands[i].ins[seat.signerAddr]);

      }
      sumOfSeatBalances = sumOfSeatBalances.add(seat.amount);
    }
    lastHandNetted = lastNettingRequestHandId;
    Netted(lastHandNetted);
    _payout(sumOfSeatBalances);
  }

  function _payout(uint256 _sumOfSeatBalances) internal {
    if (_sumOfSeatBalances > 0) {
      uint256 totalBal = address(this).balance;
      oracle.transfer(totalBal.sub(_sumOfSeatBalances));
    }

    for (uint256 i = 0; i < seats.length; i++) {
      Seat storage seat = seats[i];
      if (seat.exitHand > 0 && lastHandNetted >= seat.exitHand) {
        if (seat.amount > 0) {
          seat.senderAddr.transfer(seat.amount);
        }
        Leave(seat.senderAddr);
        delete seats[i];
      }
    }
  }

  function kill(address _dest) public onlyOwner {
    selfdestruct(_dest);
  }
}
