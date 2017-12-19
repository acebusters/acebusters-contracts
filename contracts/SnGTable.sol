pragma solidity ^0.4.11;

import './Governable.sol';
import './SafeMath.sol';

contract SnGTable is Governable {
  using SafeMath for uint;

  event Join(address indexed addr, uint256 amount);
  event NettingRequest(uint256 hand);
  event Netted(uint256 hand);
  event Leave(address addr);

  enum TableState { CoolOff, Registration, Tournament}
  TableState public state;

  address public oracle;
  uint256 internal mbi;
  uint256 public restartTime;
  uint256 public coolOffPeriod;
  uint256 public registrationPeriod;
  address public tokenAddr;
  uint256 roundingFactor = 1000000000;

  bool public active = true;

  struct Seat {
    address senderAddr;
    uint256 amount;
    address signerAddr;
    uint256 exitHand;
  }

  Seat[] public seats;

  uint32 public lastHandNetted;

  uint32 public lastNettingRequestHandId;
  uint256 public lastNettingRequestTime;
  uint256 disputeTime;

  function SnGTable(address _oracle, uint256 _mbi, uint256 _seats, uint256 _disputeTime, uint256 _coolOffPeriod, uint256 _registrationPeriod) {
    oracle = _oracle;
    mbi = _mbi;
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

  // onlyOwner function
  function kill(address _dest) public onlyAdmins {
    selfdestruct(_dest);
  }

  function tick() public {
    var (, , , , activePlayers) = _getLineup();
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

  function minBuyIn() constant returns (uint256) {
    return mbi;
  }

  function getLineup() public constant isState(TableState.Tournament) returns (uint256, address[] addresses, uint256[] amounts, uint256[] exitHands, uint8 activePlayers) {
    return _getLineup();
  }

  function inLineup(address _addr) public constant isState(TableState.Tournament) returns (bool) {
    return _inLineup(_addr);
  }

  // Join
  function join (bytes _data) public isState(TableState.Registration) payable {
    // check the minBuyIn
    require(mbi <= msg.value);

    uint8 pos;
    address signerAddr;
    assembly {
      pos := mload(add(_data, 1))
      signerAddr := mload(add(_data, 21))
    }
    require(signerAddr != 0x0);

    if (pos >=seats.length || seats[pos].amount > 0 || seats[pos].senderAddr != 0 || _inLineup(msg.sender)) revert();
    //seat player
    seats[pos].senderAddr = msg.sender;
    seats[pos].amount = msg.value;
    seats[pos].signerAddr = signerAddr;

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
      seats[i].amount = uint256(int256(seats[i].amount) + (int256(roundingFactor) * diff));
      sumOfSeatBalances += seats[i].amount;
    }

    lastHandNetted += handsNetted;
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

  function _getLineup() internal constant returns (uint256, address[] addresses, uint256[] amounts, uint256[] exitHands, uint8 activePlayers) {
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

  function _inLineup(address _addr) internal constant returns (bool) {
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
}
