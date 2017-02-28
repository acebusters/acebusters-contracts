pragma solidity ^0.4.7;

import "Token.sol";

contract Miner {

    uint public inflationRate; // yearly, specify like 3000 for %30
    address public nutsAddress;
    address public rewardPool;
    uint public lastTick;
    
    function Power(uint _inflationRate, address _nutsAddress, address _rewardPool) {
        inflationRate = _inflationRate;
        nutsAddress = _nutsAddress;
        rewardPool = _rewardPool;
        lastTick = now;
    }

    function configure(uint _inflationRate, address _nutsAddress, address _rewardPool) {
        inflationRate = _inflationRate;
        nutsAddress = _nutsAddress;
        rewardPool = _rewardPool;
    }

    function _tick(uint _now) internal returns (bool success) {
        uint timeSinceLastTick = lastTick - _now;
        Token token = Token(nutsAddress);
        uint totalSupply = token.totalSupply();
        address powerPool = token.powerAddress();
        uint amount = (timeSinceLastTick * inflationRate * totalSupply) / (1 years * 10000);
        if (amount < 1000) { // we don't want small amounts because of the rounding error.
            return false;
        }
        lastTick = now;
        token.issue(amount * 10);
        token.transfer(rewardPool, amount);
        token.transfer(powerPool, amount * 9);
        return true;
    }


    function tick() returns (bool success) {
        return _tick(now);
    }

// !!!!!!!!!!!!!!!!!!!!!!!! IMPORTANT !!!!!!!!!!!!!!!!!!!!!
// REMOVE THIS BEFORE DEPLOYMENT!!!!
// needed for accelerated time testing
    function tickTest(uint _now) returns (bool success) {
        return _tick(_now);
    }
// !!!!!!!!!!!!!!!!!!!!!!!! IMPORTANT !!!!!!!!!!!!!!!!!!!!!

}