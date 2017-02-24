pragma solidity ^0.4.7;
import "Token.sol";

contract Table {

    Token public token;
    uint public smallBlind;

    event Join(address addr, uint256 amount);
    event NettingRequest(uint hand);
    event Netted(uint hand);
    event Error(address err);
    
    address public oracle;
    
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
        uint96 lastHand;
    }
    
    Hand[] public hands;
    Seat[] public seats;

    mapping(address => uint) public seatMap; //both sender and receipt addr mapped here
    uint public lastHandNetted;
    
    uint public lastNettingRequestHandId;
    uint public lastNettingRequestTime;
    
    function Table(address _token, address _oracle, uint _smallBlind, uint _seats) {
        token = Token(_token);
        oracle = _oracle;
        smallBlind = _smallBlind;
        seats.length = _seats + 1;
        lastHandNetted = 0;
        seatMap[_oracle] = _seats + 1;
    }
    
    function getLineup() constant returns (uint, address[] addr, uint[] amount, uint96[] lastHand) {
        addr = new address[](seats.length - 1);
        amount = new uint[](seats.length - 1);
        lastHand = new uint96[](seats.length - 1);
        for (uint i = 1; i < seats.length; i++) {
            if (seats[i].amount > 0 && seats[i].lastHand == 0) {
                addr[i - 1] = seats[i].senderAddr;
                amount[i - 1] = seats[i].amount;
                lastHand[i - 1] = seats[i].lastHand;
            }
        }
        return (lastHandNetted, addr, amount, lastHand);
    }
    
    function getIn(uint96 _handId, address _addr) constant returns (uint96) {
        return hands[_handId].ins[_addr];
    }
    
    function getOut(uint96 _handId, address _addr) constant returns (uint96, uint) {
        return (hands[_handId].outs[_addr], hands[_handId].claimCount);
    }
    
    // This function is called if players agree to settle without
    // the payment channel. a list of new balances at specific signed by
    // all players and the oracle expected here.
    function settle(bytes _newBalances, bytes _sigs) {
        // keeping track of who has signed,
        // we'll use the receipt signing key for this now.
        uint96 handId;
        address dest;
        address[] memory addr;
        uint96[] memory amount;
        assembly {
            handId := mload(add(_newBalances, 12))
            dest := mload(add(_newBalances, 32))
        }
        if (handId <= lastHandNetted) {
            return;
        }
        if (dest != address(this)) {
            return;
        }
        assembly {
            //prepare loop
            let i := 0
            let len := div(sub(calldataload(68), 32),32)
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
                    let elem := mload(add(_newBalances, add(52, mul(i, 0x20))))
                    mstore(add(addr, add(32, mul(i, 0x20))), elem)
                    elem := mload(add(_newBalances, add(64, mul(i, 0x20))))
                    mstore(add(amount, add(32, mul(i, 0x20))), elem)
                    i := add(i, 1)
                }
                jump(loop)
            end:
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
                return;
            }
        }
        
        //set new balances
        for (i = 0; i < addr.length; i++) {
            seats[seatMap[addr[i]]].amount = amount[i];
        }
        lastHandNetted = handId;
        Netted(handId);
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
                seats[i].signerAddr == _signerAddr)
                throw;
        
        //seat player
        if (_pos == 0 || seats[_pos].amount > 0 || seats[_pos].senderAddr != 0) {
            throw;
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
    
    function leave(bytes _leaveReceipt) {
        uint96 handId;
        address dest;
        address signer;
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            handId := mload(add(_leaveReceipt, 12))
            dest := mload(add(_leaveReceipt, 32))
            signer := mload(add(_leaveReceipt, 52))
            r := mload(add(_leaveReceipt, 84))
            s := mload(add(_leaveReceipt, 116))
            v := mload(add(_leaveReceipt, 117))
        }
        if (dest != address(this)) {
            Error(dest);
          return;
        }
        
        if (ecrecover(sha3(handId, dest, signer), v, r, s) != oracle) {
            Error(oracle);
          return;
        }

        seats[seatMap[signer]].lastHand = handId;
        //create new netting request
        if (lastHandNetted < handId && lastNettingRequestHandId < handId) {
            NettingRequest(handId);
            lastNettingRequestHandId = handId;
            lastNettingRequestTime = now;
        } else {
            Error(0x0);
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
        if (lastHandNetted <  seat.lastHand)
            throw;
        if (!token.transfer(_sender, seats[pos].amount))
            throw;
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