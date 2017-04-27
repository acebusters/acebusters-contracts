pragma solidity ^0.4.8;

import "./Token.sol";

contract Table {

    event Join(address addr, uint256 amount);
    event NettingRequest(uint hand);
    event Netted(uint hand);
    event Leave(address addr);
    event Error(address addr, uint errorCode);
    // 3 : No duplicate players
    // 4 : Seat not available
    // 5 : table closing
    // 6 : table reopened

    address public oracle;
    uint96 public smallBlind;
    Token public token;
    
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
        uint96 amount;
        address signerAddr;
        uint32 exitHand;
    }
    
    Hand[] public hands;
    Seat[] public seats;

    mapping(address => uint) public seatMap; //both sender and receipt addr mapped here
    uint32 public lastHandNetted;
    
    uint32 public lastNettingRequestHandId;
    uint public lastNettingRequestTime;
    
    function Table(address _token, address _oracle, uint96 _smallBlind, uint _seats) {
        token = Token(_token);
        oracle = _oracle;
        smallBlind = _smallBlind;
        seats.length = _seats + 1;
        // checked in settle() for seatMap[oracle] !== 0
        seatMap[_oracle] = _seats + 1;
        // lastHandNetted and player's exitHand are critical for security of funds.
        // in payout() table checks (lastHandNetted >=  seat.exitHand) for grant.
        // exitHand is provided by oracle with leave receipt. On join, exitHand is
        // set to 0 though.
        // if lhn == 0, players would be able to exit hand 0 without leave receipt.
        // hence, table starts with lhn = 1, oracle's first handId is lhn + 1 = 2. 
        lastHandNetted = 1;
        lastNettingRequestHandId = 1;
        lastNettingRequestTime = now;
    }
    
    function getLineup() constant returns (uint, address[] addresses, uint[] amounts, uint96[] exitHands) {
        addresses = new address[](seats.length - 1);
        amounts = new uint[](seats.length - 1);
        exitHands = new uint96[](seats.length - 1);
        for (uint i = 1; i < seats.length; i++) {
            addresses[i - 1] = seats[i].signerAddr;
            amounts[i - 1] = seats[i].amount;
            exitHands[i - 1] = seats[i].exitHand;
        }
        return (lastHandNetted, addresses, amounts, exitHands);
    }
    
    function getIn(uint96 _handId, address _addr) constant returns (uint96) {
        return hands[_handId].ins[_addr];
    }
    
    function getOut(uint96 _handId, address _addr) constant returns (uint96, uint) {
        return (hands[_handId].outs[_addr], hands[_handId].claimCount);
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
        if (!active) {
          Error(0x0, 5);
        } else {
          Error(0x0, 6);
        }
    }
    
    function withdrawRake(bytes32 _r, bytes32 _s, bytes32 _pl) {
        uint8 v;
        address dest;
        uint32 handId;

        assembly {
            v := calldataload(37)
            dest := calldataload(57)
            handId := calldataload(61)
        }

        if (dest != address(this)) {
          throw;
        }
        
        if (lastHandNetted != handId) {
          throw;
        }
        
        if (ecrecover(sha3(uint8(0), dest, handId, uint56(0)), v, _r, _s) != oracle) {
          throw;
        }

        uint playerBal = 0;
        for (uint i = 1; i < seats.length; i++ ) {
            playerBal += seats[i].amount;
        }
        uint totalBal = token.balanceOf(address(this));
        if (totalBal < playerBal) {
          throw;
        }
        
        if (totalBal - playerBal > 0) {
          token.transfer(oracle, totalBal - playerBal);
        }
    }
    
    // This function is called if players agree to settle without
    // the payment channel. a list of new balances at specific signed by
    // all players and the oracle expected here.
    // TODO(ab): think about rebuy, total balances are probably no good idea
    // relativ balances better to model rebuy?
    function settle(bytes _newBalances, bytes _sigs) {
        // keeping track of who has signed,
        // we'll use the receipt signing key for this now.
        uint32 handId;
        uint128 dest;
        address[] memory addr;
        uint64[] memory amount;
        assembly {
            handId := mload(add(_newBalances, 4))
            dest := mload(add(_newBalances, 20))
        }
        if (handId <= lastHandNetted) {
            return;
        }
        if (dest != uint128(address(this))) {
            return;
        }

        for (uint i = 0; i < _sigs.length / 65; i++) {
            uint8 v;
            bytes32 r;
            bytes32 s;
            assembly {
                r := mload(add(_sigs, add(32, mul(i, 65))))
                s := mload(add(_sigs, add(64, mul(i, 65))))
                v := mload(add(_sigs, add(65, mul(i, 65))))
            }
            if (seatMap[ecrecover(sha3(_newBalances), v, r, s)] == 0) {
              throw;
            }
        }
        
        assembly {
            //prepare loop
            let i := 0
            let len := div(sub(calldataload(68), 20),28)
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
                    let elem := mload(add(_newBalances, add(28, mul(i, 28))))
                    mstore(add(amount, add(32, mul(i, 0x20))), elem)
                    elem := mload(add(_newBalances, add(48, mul(i, 28))))
                    mstore(add(addr, add(32, mul(i, 0x20))), elem)
                    i := add(i, 1)
                }
                jump(loop)
            end:
        }
        
        //set new balances
        for (i = 0; i < addr.length; i++) {
          if (addr[i] != oracle) {
            seats[seatMap[addr[i]]].amount = uint96(amount[i]);
          }
        }
        lastHandNetted = handId;
        Netted(handId);
    }
    
    function rebuy(uint96 _buyIn) {
      uint pos = 0;
      for (uint i = 1; i < seats.length; i++ ) {
        if (seats[i].senderAddr == msg.sender) {
          pos = i;
        }
      }
      if (pos == 0) {
          throw;
      }
      //check the dough
      if (40 * smallBlind > _buyIn || (_buyIn + seats[pos].amount) > 400 * smallBlind) {
        throw;
      }
      if (token.transferFrom(msg.sender, this, _buyIn)) {
        seats[pos].amount += _buyIn;
        Join(msg.sender, _buyIn);
      }
    }

    function join(uint96 _buyIn, address _signerAddr, uint _pos) {
        
        //check the dough
        if (40 * smallBlind > _buyIn || _buyIn > 400 * smallBlind) {
            throw;
        }
        
        //no beggars
        if (token.balanceOf(msg.sender) < _buyIn || token.allowance(msg.sender, this) < _buyIn) {
            throw;
        }
        
        //avoid duplicate players
        for (uint i = 1; i < seats.length; i++ )
            if (seats[i].senderAddr == msg.sender ||
                seats[i].signerAddr == msg.sender ||
                seats[i].senderAddr == _signerAddr ||
                seats[i].signerAddr == _signerAddr) {
                    Error(msg.sender, 3);
                    return;
                }
        
        //seat player
        if (_pos == 0 || seats[_pos].amount > 0 || seats[_pos].senderAddr != 0) {
            Error(msg.sender, 4);
            return;
        }
        if (token.transferFrom(msg.sender, this, _buyIn)) {
            seats[_pos].senderAddr = msg.sender;
            seats[_pos].amount = _buyIn;
            seats[_pos].signerAddr = _signerAddr;
            seatMap[msg.sender] = _pos;
            seatMap[_signerAddr] = _pos;
            Join(msg.sender, _buyIn);
        }
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

        seats[seatMap[signer]].exitHand = handId;
        //create new netting request
        if (lastHandNetted < handId && lastNettingRequestHandId < handId) {
            NettingRequest(handId);
            lastNettingRequestHandId = handId;
            lastNettingRequestTime = now;
        }
    }

    function net() {
        netHelp(now);
    }
    
    function netHelp(uint _now) {
        if (_now  > lastNettingRequestTime + 60 * 10) {
            for (uint i = lastHandNetted + 1; i < lastNettingRequestHandId; i++ ) {
                for (uint j = 1; j < seats.length; j++) {
                    int amount = int(seats[j].amount);
                    amount += int(hands[i].outs[seats[j].signerAddr]) - int(hands[i].ins[seats[j].signerAddr]);
                    seats[j].amount = uint96(amount);
                }
            }
            lastHandNetted = lastNettingRequestHandId;
            Netted(lastHandNetted);
        }
    }

    function payout() {
        payoutFrom(msg.sender);
    }

    function payoutFrom(address _sender) {
        uint pos = seatMap[_sender];
        Seat seat = seats[pos];
        if (lastHandNetted < seat.exitHand) {
            throw;
        }
        if (seat.exitHand == 0) {
            throw;
        }
        if (seat.amount > 0) {
            if (!token.transfer(seat.senderAddr, seat.amount))
                throw;
        }
        Leave(seat.signerAddr);
        delete seatMap[seat.senderAddr];
        delete seatMap[seat.signerAddr];
        delete seats[pos];
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
        if (hands.length <= handId)
            hands.length = handId + 1;
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
            if (seatMap[signerAddr] == 0)
                continue;
            if (handId <= lastHandNetted || handId >= hands.length)
                continue;
            if (hands[handId].ins[signerAddr] >= amount)
                continue;
            hands[handId].ins[signerAddr] = amount;
            writeCount++;
        }
        return writeCount;
    }

}