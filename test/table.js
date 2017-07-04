import { Receipt } from 'poker-helper';
import ethUtil from 'ethereumjs-util';
import BigNumber from 'bignumber.js';
var Token = artifacts.require('../contracts/Token.sol');
var Table = artifacts.require('../contracts/Table.sol');

const signStr = (privStr, payloadStr) => {
  const priv = new Buffer(privStr.replace('0x', ''), 'hex');
  const payload = new Buffer(payloadStr.replace('0x', ''), 'hex');
  const hash = ethUtil.sha3(payload);
  const sig = ethUtil.ecsign(hash, priv);
  return sig.r.toString('hex') + sig.s.toString('hex') + sig.v.toString(16);
};

contract('Table', function(accounts) {

  const P0_ADDR = '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74';
  const P0_PRIV = '0x278a5de700e29faae8e40e366ec5012b5ec63d36ec77e8a2417154cc1d25383f';

  const P1_ADDR = '0xe10f3d125e5f4c753a6456fc37123cf17c6900f2';
  const P1_PRIV = '0x7bc8feb5e1ce2927480de19d8bc1dc6874678c016ae53a2eec6a6e9df717bfac';

  const ORACLE = '0x82e8c6cf42c8d1ff9594b17a3f50e94a12cc860f';
  const ORACLE_PRIV = '0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4';

  const P_EMPTY = '0x0000000000000000000000000000000000000000';

  it("should join table, then settle, then leave.", function(done) {

    var token;
    var table;

    Token.new().then((contract) => {
      token = contract;
      return Table.new(token.address, ORACLE, 5000, 2);
    }).then(function(contract) {
      table = contract;
      return table.smallBlind.call();
    }).then(function(blind) {
      assert.equal(blind.toNumber(), 5000, 'config failed.');
      return token.issue(2000000);
    }).then(function(txHash){
      return token.approve(table.address, 1000000, {from: accounts[0]});
    }).then(function(txHash){
      return token.transfer(accounts[1], 1000000, {from: accounts[0]});
    }).then(function(txHash){
      return table.join(300000, P0_ADDR, 0, "test", {from: accounts[0]});
    }).then(function(){
      return token.approve(table.address, 1000000, {from: accounts[1]});
    }).then(function(txHash){
      return table.join(355360, P1_ADDR, 1, "test2", {from: accounts[1]});
    }).then(function(txHash){
      return table.seats.call(0);
    }).then(function(seat){
      assert.equal(seat[0], accounts[0], 'join failed.');
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[0], accounts[1], 'join failed.');
      // create the leave receipt here.
      const leaveReceipt = new Receipt(table.address).leave(3, P1_ADDR).sign(ORACLE_PRIV);
      return table.leave(...Receipt.parseToParams(leaveReceipt));
    }).then(function(txHash){
      return table.seats.call(1);
    }).then(function(seat){
      // reading the exitHand from hand
      assert.equal(seat[3].toNumber(), 3, 'leave request failed.');
      var settleReceipt = new Receipt(table.address).settle(1, 3, [new BigNumber(90000000000000), new BigNumber(-100000000000000)]).sign(ORACLE_PRIV);
      return table.settle(...Receipt.parseToParams(settleReceipt));
    }).then(function(txHash){
      return table.lastHandNetted.call();
    }).then(function(lhn){
      assert.equal(lhn.toNumber(), 3, 'settlement failed for last hand.');
      return table.seats.call(0);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 390000, 'settlement failed for seat pos 2.');
      return token.balanceOf.call(ORACLE);
    }).then(function(oracleBal){
      assert.equal(oracleBal.toNumber(), 10000, 'withdraw rake failed.');
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 0, 'payout failed.');
    }).then(done).catch(done);

  });

  it("should join table, then settle, then leave broke.", function(done) {

    var token;
    var table;

    Token.new().then((contract) => {
      token = contract;
      return Table.new(token.address, ORACLE, 5000, 2);
    }).then(function(contract) {
      table = contract;
      return table.smallBlind.call();
    }).then(function(blind) {
      assert.equal(blind.toNumber(), 5000, 'config failed.');
      return token.issue(2000000);
    }).then(function(txHash){
      return token.approve(table.address, 1000000, {from: accounts[0]});
    }).then(function(txHash){
      return token.transfer(accounts[1], 1000000, {from: accounts[0]});
    }).then(function(txHash){
      return table.join(300000, P0_ADDR, 0, "test", {from: accounts[0]});
    }).then(function(){
      return token.approve(table.address, 1000000, {from: accounts[1]});
    }).then(function(txHash){
      return table.join(355360, P1_ADDR, 1, "test2", {from: accounts[1]});
    }).then(function(txHash){
      return table.seats.call(0);
    }).then(function(seat){
      assert.equal(seat[0], accounts[0], 'join failed.');
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[0], accounts[1], 'join failed.');
      // create the leave receipt here.
      const leaveReceipt = new Receipt(table.address).leave(3, P0_ADDR).sign(ORACLE_PRIV);
      return table.leave(...Receipt.parseToParams(leaveReceipt));
    }).then(function(txHash){
      return table.seats.call(0);
    }).then(function(seat){
      // reading the exitHand from hand
      assert.equal(seat[3].toNumber(), 3, 'leave request failed.');
      // prepare settlement
      var settleReceipt = new Receipt(table.address).settle(1, 3, [new BigNumber(-300000000000000), new BigNumber(250000000000000)]).sign(ORACLE_PRIV);
      return table.settle(...Receipt.parseToParams(settleReceipt));
    }).then(function(txHash){
      return table.lastHandNetted.call();
    }).then(function(exitHand){
      assert.equal(exitHand.toNumber(), 3, 'settlement failed for last hand.');
    }).then(function(seat){
      return table.seats.call(0);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 0, 'settlement failed for seat pos 1.');
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 605360, 'settlement failed for seat pos 2.');
    //   return table.payout({from: accounts[0]});
    // }).then(function(txHash){
      return table.seats.call(0);
    }).then(function(seat){
      assert.equal(seat[0], P_EMPTY, 'payout failed.');
    }).then(done).catch(done);

  });

  it('should join table, then net, then leave.', function(done) {

    var token;
    var table;

    //bet 12000 p_0 hand 4 12 + 12 + 4 + 20 
    var bet41 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000002ee0';
    var betSig41 = signStr(P0_PRIV, bet41);
    //bet 15000 p_0 hand 4
    var bet411 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000003a98';
    var betSig411 = signStr(P0_PRIV, bet411);
    //bet 17000 p_1 hand 4
    var bet42 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000004268';
    var betSig42 = signStr(P1_PRIV, bet42);
    //dist switch hand 4 claim 0
    var dist40 = '9dd00b590000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000004268e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000003a98';
    var distSig40 = signStr(ORACLE_PRIV, dist40);


    //bet 20000 p_0 hand 5
    var bet51 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000000004e20';
    var betSig51 = signStr(P0_PRIV, bet51);
    //bet 20000 p_1 hand 5
    var bet52 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000000004e20';
    var betSig52 = signStr(P1_PRIV, bet52);
    //dist p_1 winns all hand 5 claim 0
    var dist50 = '9dd00b590000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000009c40f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000000000';
    var distSig50 = signStr(P1_PRIV, dist50);
    //dist p_0 winns all hand 5 claim 1
    var dist51 = '9dd00b590000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000000000f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000009c40';
    var distSig51 = signStr(ORACLE_PRIV, dist51);

    //bet 12000 p_0 hand 6
    var bet61 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000002ee0';
    var betSig61 = signStr(P0_PRIV, bet61);
    //bet 20000 p_1 hand 6
    var bet62 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000004e20';
    var betSig62 = signStr(P1_PRIV, bet62);
    //dist p_1 wins all hand 6 claim 1
    var dist61 = '9dd00b590000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000007d00f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000000000';
    var distSig61 = signStr(ORACLE_PRIV, dist61);
    //dist p_0 winns all hand 6 claim 0
    var dist60 = '9dd00b590000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000000000f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000007d00';
    var distSig60 = signStr(ORACLE_PRIV, dist60);


    Token.new().then((contract) => {
      token = contract;
      return Table.new(token.address, ORACLE, 5000, 2);
    }).then(function(contract) {
      table = contract;
      return table.smallBlind.call();
    }).then(function(blind) {
      assert.equal(blind.toNumber(), 5000, 'config failed.');
      return token.issue(2000000);
    }).then(function(txHash){
      return token.approve(table.address, 1000000, {from: accounts[0]});
    }).then(function(txHash){
      return token.transfer(accounts[1], 1000000, {from: accounts[0]});
    }).then(function(txHash){
      return table.join(300000, P0_ADDR, 0, "test", {from: accounts[0]});
    }).then(function(txHash){
      return token.approve(table.address, 400000, {from: accounts[1]});      
    }).then(function(txHash){
      return table.join(355360, P1_ADDR, 1, "test2", {from: accounts[1]});
    }).then(function(txHash){

      return table.submitDists('0x' + dist40, '0x' + distSig40);
    }).then(function(txHash){
      var bets4 = '0x' + bet41 + bet42 + bet411;
      var betSigs4 = '0x' + betSig41 + betSig42 + betSig411;
      return table.submitBets(bets4, betSigs4);
    }).then(function(txHash){
      return table.getIn.call(4, P0_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 15000, 'bet submission failed.');
      return table.getIn.call(4, P1_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 17000, 'bet submission failed.');

      return table.getOut.call(4, P0_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 17000, 'dist submission failed.');
      return table.getOut.call(4, P1_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 15000, 'dist submission failed.');

      var dists = '0x' + dist40 + dist50 + dist51 + dist61 + dist60;
      var distSigs = '0x' + distSig40 + distSig50 + distSig51 + distSig61 + distSig60;
      return table.submitDists(dists, distSigs);
    }).then(function(txHash){
      var bets = '0x' + bet41 + bet42 + bet411 + bet51 + bet52 + bet61 + bet62;
      var betSigs = '0x' + betSig41 + betSig42 + betSig411 + betSig51 + betSig52 + betSig61 + betSig62;
      return table.submitBets(bets, betSigs);
    }).then(function(txHash){

      return table.getIn.call(5, P0_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');
      return table.getIn.call(5, P1_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');

      return table.getOut.call(5, P0_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 40000, 'dist submission failed.');
      return table.getOut.call(5, P1_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');

      return table.getIn.call(6, P0_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 12000, 'bet submission failed.');
      return table.getIn.call(6, P1_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');

      return table.getOut.call(6, P0_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
      return table.getOut.call(6, P1_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 32000, 'dist submission failed.');
      // make leave receipt
      const leaveReceipt = new Receipt(table.address).leave(7, P1_ADDR).sign(ORACLE_PRIV);
      return table.leave(...Receipt.parseToParams(leaveReceipt));
    }).then(function(txHash){
      return table.lastNettingRequestHandId.call();
    }).then(function(lastNettingRequestHandId){
      assert.equal(lastNettingRequestHandId.toNumber(), 7, 'leave request failed.');
      return table.netHelp((Date.now() / 1000 | 0) + 61 * 10);
    }).then(function(txHash){
      return table.lastHandNetted.call();
    }).then(function(exitHand){
      assert.equal(exitHand.toNumber(), 7, 'settlement failed.');
    }).then(function(seat){

      // 300000 buyin + 2000 (hand3) + 20000 (hand4) - 12000 = 310000
      return table.seats.call(0);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 310000, 'settlement failed.');
      // rebuy with account 0
      return table.rebuy(300000, {from: accounts[0]});
    }).then(function(txHash){
      return table.seats.call(0);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 610000, 'settlement failed.');

      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 0, 'payout failed.');
    }).then(done).catch(done);

  });

  it('should not accept distributions that spend more than bets.');

  it('should prevent bets that spend more than estimated balance.');

  it('should test receiptAddr different from senderAddress');

});
