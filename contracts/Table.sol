import "Token.sol";

contract Table {
    Token token;
    uint public minBuyIn;
    uint public maxBuyIn;
    
    address oracle;
    
    uint[] public active;
    mapping (address => uint) partIndex;
    Participant[] public participants;
    
    struct Participant {
        address nodeAddress;
        uint256 balance;
        uint256 lastHandNetted;  //hand Id when last netted
    }
    
    struct Receipt {
        uint136 amount;     //max bet
        uint112 hand;       //which hand
        address signer;
        // uint8 v;
        // bytes32 r;
        // bytes32 s;
    }
    
    struct Distribution {
        uint112 hand;
        uint8 claimCount;   //the receipt number the oracle issued for this game, the highest is valid
        bytes32 w1;
        bytes32 w2;   //bytes32[] dists;   //list of tuple  (address player, uint96 amount) how much each player received
        //uint8 v
        //bytes32 r
        //bytes32 s
    }
    
    uint closeTimeout;     //how many blocks a hand should be open till ready to close
    uint lastClosed;        //last hand that closed
    struct Hand {
        Receipt[] receipts;
        Distribution distribution;
        uint256 lastUpdate; //if lastUpdate + settleTimout < block.number then the data of this block can be used for withdrawals
        mapping(address => int) closing;
    }
    
    Hand[] hands;  // game number increasing from 0 to 2^112
    
    function lastHand() constant returns (uint112) {
        return uint112(hands.length-1);
    }
    
    function getReceipts(uint _handId) constant returns (uint136[] amounts, address[] signers) {
        Hand hand = hands[_handId];
        amounts = new uint136[](hand.receipts.length - 1);
        signers = new address[](hand.receipts.length - 1);
        for (uint i = 1; i < hand.receipts.length; i ++) {
            amounts[i - 1] = hand.receipts[i].amount;
            signers[i - 1] = hand.receipts[i].signer;
        }
    }
    
    function getDist(uint _handId) constant returns (uint112, uint8, bytes32, bytes32) {
        Hand hand = hands[_handId];
        return (hand.distribution.hand, hand.distribution.claimCount, hand.distribution.w1, hand.distribution.w2);
    }

    function getWin(uint _handId, address addr) constant returns (int) {
        Hand hand = hands[_handId];
        return hand.closing[addr];
    }

    event LineUp(address[] active);
    event Error(uint code);
    
    function Table(address _assetAddress, address _oracle, uint _minBuyIn, uint _maxBuyIn, uint _timeout) {
        token = Token(_assetAddress);
        oracle = _oracle;
        minBuyIn = (_minBuyIn > 0) ? _minBuyIn : 4000;
        maxBuyIn = (_maxBuyIn > 0) ? _maxBuyIn : 8000;
        closeTimeout = _timeout;
        participants.length ++;
        lastClosed = 0;
    }
    
    function _buildReceipts(uint8 count, bytes memory data) internal returns (Receipt[]) {
        Receipt[] memory receipts = new Receipt[](count);
        for (uint i = 0; i < count; i ++) {
            uint pos = i * 96;
            uint136 amount;
            uint112 hand;
            uint8 v;
            bytes32 r;
            bytes32 s;
            assembly {
                amount := mload(add(data, add(pos, 17)))
                hand := mload(add(data, add(pos, 31)))
                v := mload(add(data, add(pos, 32)))
                r := mload(add(data, add(pos, 64)))
                s := mload(add(data, add(pos, 96)))
            }
            address signer = ecrecover(sha3(amount, hand), v, r, s);
            receipts[i] = Receipt(amount, hand, signer);
        }
        return receipts;
    }
    
    function _buildDistribution(bytes32 w1, bytes32 w2) internal returns (address[] players, uint96[] amounts) {
        players = new address[](2);
        amounts = new uint96[](2);
        
        for (uint i = 0; i < 2; i++) {
            bytes memory d = new bytes(32);
            for (uint j = 0; j < 32; j++) {
                d[j] = (i == 0) ? w1[j] : w2[j];
            }
            address player;
            uint96 amount;
            assembly {
                player : = mload(add(d, 20))
                amount := mload(add(d, 32))
            }
            players[i] = player;
            amounts[i] = amount;
        }
        
        return (players, amounts);
    }
    
    
    function _buildProof(uint8 count, bytes memory data) internal returns (Distribution[]) {
        Distribution[] memory distributions = new Distribution[](count);
        uint pos = 0;
        for (uint i = 0; i < count; i ++) {
            uint112 handId;
            uint8 claimCount;
            uint8 v;
            bytes32 r;
            bytes32 s;
            bytes32 w1;
            bytes32 w2;
            assembly {
                handId := mload(add(data, add(pos, 14)))
                claimCount := mload(add(data, add(pos, 15)))
                v := mload(add(data, add(pos, 16)))
                r := mload(add(data, add(pos, 48)))
                s := mload(add(data, add(pos, 80)))
                w1 := mload(add(data, add(pos, 113)))
                w2 := mload(add(data, add(pos, 145)))
            }
            bytes32[] memory dists = new bytes32[](2);
            dists[0] = w1;
            dists[1] = w2;
            if (ecrecover(sha3(handId, claimCount, w1, w2), v, r, s) != oracle) {
               throw;
            }
            distributions[i] = Distribution(handId, claimCount, w1, w2);
        }
        return distributions;
    }
    
    function report(uint8 _count, bytes memory _receipts) {
        Receipt[] memory receipts = _buildReceipts(_count, _receipts);
        for (uint i = 0; i < _count; i ++) {
            uint pos = receipts[i].hand;
            if (hands.length < pos) {
                hands.length = pos + 1;
                hands[pos].receipts.length ++;
            }
            int recPos = hands[pos].closing[receipts[i].signer];
            if (recPos < 1) {
                recPos = int(hands[pos].receipts.length++);
                hands[pos].receipts[uint(recPos)] = Receipt(receipts[i].amount, receipts[i].hand, receipts[i].signer);
                hands[pos].closing[receipts[i].signer] = recPos;
            } else {
                Receipt existing = hands[pos].receipts[uint(recPos)];
                existing.amount = (existing.amount < receipts[i].amount) ? receipts[i].amount : existing.amount;
            }
            hands[pos].lastUpdate = block.number;
        }
    }
    
    function claim(uint8 _count, bytes memory _distributions) {
        Distribution[] memory distributions = _buildProof(_count, _distributions);
        for (uint i = 0; i < distributions.length; i ++) {
            uint pos = distributions[i].hand;
            if (hands.length < pos) {
                hands.length = pos + 1;
                
            }
            if (hands[pos].distribution.hand == 0) {
                hands[pos].distribution = Distribution(distributions[i].hand, distributions[i].claimCount, distributions[i].w1, distributions[i].w2);
            }
            if (hands[pos].distribution.claimCount < distributions[i].claimCount) {
                hands[pos].distribution.claimCount = distributions[i].claimCount;
                hands[pos].distribution.w1 = distributions[i].w1;
                hands[pos].distribution.w2 = distributions[i].w2;
            }
            hands[pos].lastUpdate = block.number;
        }
    }

    function withdraw() returns (bool) {
        //1. close as many hands as possible

        uint i = lastClosed + 1;
        while (i < hands.length && hands[i].lastUpdate + closeTimeout < block.number) {
            for (uint j = 0; j < hands[i].receipts.length; j++) {
                hands[i].closing[hands[i].receipts[j].signer] = -1 * int(hands[i].receipts[j].amount);
            }

            address[] memory players;
            uint96[] memory amounts;
            (players, amounts) = _buildDistribution(hands[i].distribution.w1, hands[i].distribution.w2);
            for (j = 0; j < players.length; j++) {
                hands[i].closing[players[j]] = hands[i].closing[players[j]] + int(amounts[j]);
            }
            lastClosed = i;
            i++;
        }

        //2. net account 
        Participant part = participants[partIndex[msg.sender]];
        for (i = part.lastHandNetted; i < lastClosed; i ++) {
            int amount = hands[i].closing[msg.sender];
            if (amount > 0)
                part.balance += uint(amount);
            else
                part.balance -= uint(amount);
        }
        part.lastHandNetted = lastClosed;
        
        //TODO: make sure next hands 
        
        //3. withdraw
        return token.transfer(msg.sender, part.balance);
    }
    
    function join(uint _buyIn) {
        //check capacity and state        
        if (active.length >= 10) {
            throw;
        }
        for (uint i = 0; i < active.length; i ++) {
            if (participants[active[i]].nodeAddress == msg.sender) {
                throw;
            }
        }
        
        //check the dough
        if (minBuyIn > _buyIn || _buyIn > maxBuyIn) {
            throw;
        }
        
        if (token.balanceOf(msg.sender) < _buyIn) {
            throw;
        }
        if (!token.transferFrom(msg.sender, this, _buyIn)) {
            throw;
        }
        
        
        uint pos = partIndex[msg.sender];
        if (pos == 0) {
            pos = participants.length++;
        }
        
        participants[pos] = Participant(msg.sender, _buyIn, block.number);
        partIndex[msg.sender] = pos;
        
        uint seat = active.length++;
        active[seat] = pos;
        
        address[] memory actAddr = new address[](active.length);
        for (i = 0; i < active.length; i ++) {
            actAddr[i] = participants[active[i]].nodeAddress;
        }
        LineUp(actAddr);
    }
    
    
    //todo: insert new player where this one left
    function leave() {
        uint pos = 11;
        for (uint i = 0; i < active.length; i ++) {
            if (participants[active[i]].nodeAddress == msg.sender) {
                pos = i;
            }
            if (pos < 11 && i > active.length - 1) {
                active[i] = active[i + 1];
            }
        }
        if (pos == 11) {
            throw;
        } else {
            active.length--;
        }
        //settle bill;
    }
    
    function kick() {}
    
}