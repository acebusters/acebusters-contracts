import "Token.sol";

contract Table {
    Token token;
    uint minBuyIn;
    uint maxBuyIn;
    
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
        //uint8 v
        //bytes32 r
        //bytes32 s
    }
    
    struct Distribution {
        uint112 hand;
        uint8 claimCount;   //the receipt number the oracle issued for this game, the highest is valid
        bytes dists;   //list of tuple  (address player, uint136 amount) how much each player received
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
    
    event LineUp(address[] active);
    
    function Table(address _assetAddress, uint _minBuyIn, uint _maxBuyIn, uint _timeout) {
        token = Token(_assetAddress);
        minBuyIn = _minBuyIn;
        maxBuyIn = _maxBuyIn;
        closeTimeout = _timeout;
        participants.length ++;
        lastClosed = 0;
    }
    
    function _buildReceipts(uint8 count, bytes memory data) internal returns (Receipt[]) {
        Receipt[] memory receipts = new Receipt[](count);
        for (uint i = 0; i < count; i ++) {
            uint pos = i * 96;
            uint136 amount;
            uint112 game;
            uint8 v;
            bytes32 r;
            bytes32 s;
            assembly {
                amount := mload(add(data, add(pos, 17)))
                game := mload(add(data, add(pos, 31)))
                v := and(mload(add(data, add(pos, 32))), 1)
                r := mload(add(data, add(pos, 64)))
                s := mload(add(data, add(pos, 96)))
            }
            if(v < 27) v += 27;
            address signer = ecrecover(sha3(amount, game), v, r, s);
            receipts[i] = Receipt(amount, game, signer);
        }
        return receipts;
    }
    
    function _buildDistribution(bytes memory data) internal returns (address[] players, uint136[] amounts) {
        players = new address[](data.length / 37);
        amounts = new uint136[](data.length / 37);
        
        for (uint i = 0; i < data.length / 37; i++) {
            uint pos = i  * 37;
            address player;
            uint136 amount;
            assembly {
                player : = mload(add(data, add(pos, 20)))
                amount := mload(add(data, add(pos, 37)))
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
            uint112 game;
            uint8 claimCount;
            uint8 v;
            bytes32 r;
            bytes32 s;
            uint8 distsLength;
            bytes memory dists;
            assembly {
                game := mload(add(data, add(pos, 14)))
                claimCount := mload(add(data, add(pos, 15)))
                v := and(mload(add(data, add(pos, 16))), 1)
                r := mload(add(data, add(pos, 48)))
                s := mload(add(data, add(pos, 80)))
                distsLength := mload(add(data, add(pos, 88)))
                dists := mload(add(data, add(pos, distsLength)))
            }
            pos += pos + 88 + distsLength;
            if(v < 27) v += 27;
            address signer = ecrecover(sha3(game, claimCount, dists), v, r, s);
            if (signer != oracle) {
                throw;
            }
            distributions[i] = Distribution(game, claimCount, dists);
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
        for (uint i = 0; i < _count; i ++) {
            uint pos = distributions[i].hand;
            if (hands.length < pos) {
                hands.length = pos + 1;
                hands[pos].distribution = Distribution(distributions[i].hand, distributions[i].claimCount, distributions[i].dists);
            }
            if (hands[pos].distribution.claimCount < distributions[i].claimCount) {
                hands[pos].distribution.claimCount = distributions[i].claimCount;
                hands[pos].distribution.dists = distributions[i].dists;
            }
            hands[pos].lastUpdate = block.number;
        }
    }
    
    function withdraw() returns (bool) {
        //1. close as many hands as possible
        uint i = lastClosed + 1;
        while (hands[i].lastUpdate + closeTimeout < block.number) {
            for (uint j = 0; j < hands[i].receipts.length; j++) {
                hands[i].closing[hands[i].receipts[j].signer] = -1 * int(hands[i].receipts[j].amount);
            }
            address[] memory players;
            uint136[] memory amounts;
            (players, amounts) = _buildDistribution(hands[i].distribution.dists);
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