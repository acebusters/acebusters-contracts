//pragma solidity ^0.4.1;
import "Token.sol";

contract Table {
    Token token;
    uint public minBuyIn;
    uint public maxBuyIn;
    
    event NettingRequest(uint hand);
    event Netted(uint hand);
    
    address oracle = 0xf3beac30c498d9e26865f34fcaa57dbb935b0d74;
    
    struct Hand {
        //in
        mapping (address => uint96) ins;
        //out
        uint claimCount;
        mapping (address => uint96) outs;
    }

    struct Seat {
        address addr;
        uint96 amount;
        uint lastHand;
        bytes32 conn;
    }
    
    Hand[] hands;
    Seat[] seats;
    mapping(address => uint) seatMap;
    uint public lastHandNetted;
    
    uint public lastNettingRequestHandId;
    uint public lastNettingRequestTime;
    
    function Table() {
        seats.length = 10;
        lastHandNetted = 0;
    }
    
    function getLineup() constant returns (address[] addr, uint96[] amount, bytes32[] conn) {
        addr = new address[](seats.length);
        amount = new uint96[](seats.length);
        conn = new bytes32[](seats.length);
        for (uint i = 0; i < seats.length; i++) {
            if (seats[i].amount > 0 && seats[i].lastHand == 0) {
                addr[i] = seats[i].addr;
                amount[i] = seats[i].amount;
                conn[i] = seats[i].conn;
            }
        }
        return (addr, amount, conn);
    }
    
    function settle(bytes _newBalances, bytes _sigs) returns (bool) {
        mapping(address => uint96) hasSigned;
        uint handId;
        address[] memory addr;
        uint96[] memory amount;
        assembly {
            handId := mload(add(_newBalances, 36))
            //prepare loop
            let i := 0
            let len := mload(add(_newBalances, 100))
            //create addr array
            addr := mload(0x40)
            mstore(addr, 0x20)
            addr := add(0x20, addr)
            mstore(addr, len)
            //create amount array
            amount := add(0x40, add(addr, len))
            mstore(amount, 0x20)
            amount := add(0x20, amount)
            mstore(amount, len)
            mstore(0x40, add(amount, and(add(add(len, 0x20), 0x1f), not(0x1f))))
            
            loop:
                jumpi(end, eq(i, len))
                {
                    i := add(i, 1)
                    let elem := mload(add(_newBalances, add(120, mul(i, 0x20))))
                    mstore(add(addr, mul(i, 0x20)), elem)
                    elem := mload(add(_newBalances, add(132, mul(i, 0x20))))
                    mstore(add(amount, mul(i, 0x20)), elem)
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
            hasSigned[ecrecover(sha3(_newBalances), v, r, s)] = amount[i];
        }
        
        //check sigs
        bool allSigned = true;
        for (i = 0; i < seats.length; i++)
            if(seats[i].amount > 0)
                allSigned == allSigned && (hasSigned[seats[i].addr] > 0);
        allSigned = (hasSigned[oracle] > 0);
        if (!allSigned)
            throw;
        
        //set new balances
        for (i = 0; i < seats.length; i++) {
            seats[i].amount = hasSigned[seats[i].addr];
        }
        lastHandNetted = handId;
        Netted(handId);
    }
    
    function join(uint96 _buyIn, bytes32 _conn) {
        
        //check the dough
        if (minBuyIn > _buyIn || _buyIn > maxBuyIn) {
            throw;
        }
        
        //no beggars
        if (token.balanceOf(msg.sender) < _buyIn) {
            throw;
        }
        
        //avoid duplicate players
        for (uint i = 0; i < seats.length; i++ )
            if (seats[i].addr == msg.sender)
                throw;
        
        //seat player
        for (i = 0; i < seats.length; i++ ) {
            if (seats[i].amount == 0) {
                if (token.transferFrom(msg.sender, this, _buyIn)) {
                    seats[i].addr = msg.sender;
                    seats[i].amount = _buyIn;
                    seats[i].conn = _conn;
                }
            }
            break;
        }
    }
    
    function leave(bytes _leaveReceipt) returns (address) {
        bytes4 name;
        uint handId;
        address leaver;
        uint8 v;
        bytes32 r;
        bytes32 s;

        assembly {
            name := mload(add(_leaveReceipt, 4))
            handId := mload(add(_leaveReceipt, 36))
            leaver := mload(add(_leaveReceipt, 68))
            r := mload(add(_leaveReceipt, 100))
            s := mload(add(_leaveReceipt, 132))
            v := mload(add(_leaveReceipt, 133))
        }
        name = 0x6c28a3a9; //todo: fix
        address signer = ecrecover(sha3(name, handId, bytes32(leaver)), v, r, s);
        if (signer != oracle)
            throw;

        seats[seatMap[leaver]].lastHand = handId;
        //create new netting request
        if (lastNettingRequestHandId < handId) {
            NettingRequest(handId);
            lastNettingRequestHandId = handId;
            lastNettingRequestTime = now;
        }
    }
    
    function net() {
        if (now  > lastNettingRequestTime + 60 * 10) {
            for (uint i = lastHandNetted + 1; i <= lastNettingRequestHandId; i++ ) {
                for (uint j = 0; j < seats.length; j++) {
                    int amount = int(seats[j].amount);
                    amount += int(hands[i].outs[seats[j].addr]) - int(hands[i].ins[seats[j].addr]);
                    seats[j].amount = uint96(amount);
                }
            }
            lastHandNetted = lastNettingRequestHandId;
            Netted(lastHandNetted);
        }
    }

    function payout() {
        uint pos = seatMap[msg.sender];
        Seat seat = seats[pos];
        if (lastHandNetted <  seat.lastHand)
            throw;
        token.transfer(msg.sender, seats[pos].amount);
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
            amount := add(0x40, add(addr, len))
            mstore(amount, 0x20)
            amount := add(0x20, amount)
            mstore(amount, len)
            mstore(0x40, add(amount, and(add(add(len, 0x20), 0x1f), not(0x1f))))
            
            loop:
                jumpi(end, eq(i, len))
                {
                    i := add(i, 1)
                    let elem := mload(add(_receipt, add(120, mul(i, 0x20))))
                    mstore(add(addr, mul(i, 0x20)), elem)
                    elem := mload(add(_receipt, add(132, mul(i, 0x20))))
                    mstore(add(amount, mul(i, 0x20)), elem)
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
            if (handId < hands.length && hands[handId].claimCount <= claimCount )
                continue;
            _storeDist(receipt);
            writeCount++;
        }
        return writeCount;
    }
    
    function submitBets(bytes _bets, bytes _sigs) returns (uint) {
        uint writeCount = 0;
        for (uint elemPos = 0; elemPos < _sigs.length / 65; elemPos++) {
            bytes4 name;
            uint handId;
            uint96 amount;
            address addr;
            bytes32 r;
            bytes32 s;
            uint8 v;
            assembly {
                name := mload(add(_bets, add(4, mul(elemPos, 100))))
                handId := mload(add(_bets, add(36, mul(elemPos, 100))))
                amount := mload(add(_bets, add(68, mul(elemPos, 100))))
                addr := mload(add(_bets, add(100, mul(elemPos, 100))))
                
                r := mload(add(_sigs, add(32, mul(elemPos, 65))))
                s := mload(add(_sigs, add(64, mul(elemPos, 65))))
                v := mload(add(_sigs, add(65, mul(elemPos, 65))))
            }
            //todo: implement to check name
            if (ecrecover(sha3(name, handId, amount), v, r, s) != addr)
                continue;
            if (handId <= lastHandNetted || handId >= hands.length)
                continue;
            if (hands[handId].ins[addr] >= amount)
                continue;
            hands[handId].ins[addr] = amount;
            writeCount++;
        }
        return writeCount;
    }


}