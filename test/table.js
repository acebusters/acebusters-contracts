import { Receipt } from 'poker-helper';
import ethUtil from 'ethereumjs-util';
import BigNumber from 'bignumber.js';
var Token = artifacts.require('../contracts/ERC223BasicToken.sol');
var Table = artifacts.require('../contracts/Table.sol');

const signStr = (privStr, payloadStr) => {
  const priv = new Buffer(privStr.replace('0x', ''), 'hex');
  const payload = new Buffer(payloadStr.replace('0x', ''), 'hex');
  const hash = ethUtil.sha3(payload);
  const sig = ethUtil.ecsign(hash, priv);
  return sig.r.toString('hex') + sig.s.toString('hex') + sig.v.toString(16);
};

contract('Table', function(accounts) {

  const P0_ADDR = 'f3beac30c498d9e26865f34fcaa57dbb935b0d74';
  const P0_PRIV = '0x278a5de700e29faae8e40e366ec5012b5ec63d36ec77e8a2417154cc1d25383f';

  const P1_ADDR = 'e10f3d125e5f4c753a6456fc37123cf17c6900f2';
  const P1_PRIV = '0x7bc8feb5e1ce2927480de19d8bc1dc6874678c016ae53a2eec6a6e9df717bfac';

  const ORACLE = '0x82e8c6cf42c8d1ff9594b17a3f50e94a12cc860f';
  const ORACLE_PRIV = '0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4';

  const P_EMPTY = '0x0000000000000000000000000000000000000000';

  it("should join table, then settle, then leave.", async () => {
    const token = await Token.new();
    const table = await Table.new(token.address, ORACLE, 2000000000000, 2);
    const blind = await table.smallBlind.call();
    assert.equal(blind.toNumber(), 2000000000000, 'config failed.');
    await token.transfer(accounts[1], 100000000000000);
    await token.transData(table.address, 100000000000000, '0x00' + P0_ADDR);
    await token.transData(table.address, 100000000000000, '0x01' + P1_ADDR, {from: accounts[1]});
    let seat = await table.seats.call(0);
    assert.equal(seat[0], accounts[0], 'join failed.');
    seat = await table.seats.call(1);
    assert.equal(seat[0], accounts[1], 'join failed.');
    // create the leave receipt here.
    const leaveReceipt = new Receipt(table.address).leave(3, P1_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    seat = await table.seats.call(1);
    assert.equal(seat[3].toNumber(), 3, 'leave request failed.');
    const settleReceipt = new Receipt(table.address).settle(1, 3, [new BigNumber(9000000000000), new BigNumber(-10000000000000)]).sign(ORACLE_PRIV);
    await table.settle(...Receipt.parseToParams(settleReceipt));
    const lhn = await table.lastHandNetted.call();
    assert.equal(lhn.toNumber(), 3, 'settlement failed for last hand.');
    seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), 109000, 'settlement failed for seat pos 2.');
    const oracleBal = await token.balanceOf.call(ORACLE);
    assert.equal(oracleBal.toNumber(), 1000000000000, 'withdraw rake failed.');
    seat = await table.seats.call(1);
    assert.equal(seat[1].toNumber(), 0, 'payout failed.');
  });

  it("should join table, then settle, then leave broke.", async () => {
    const token = await Token.new();
    const table = await Table.new(token.address, ORACLE, 2000000000000, 2);
    await token.transfer(accounts[1], 100000000000000);
    await token.transData(table.address, 100000000000000, '0x00' + P0_ADDR);
    await token.transData(table.address, 100000000000000, '0x01' + P1_ADDR, {from: accounts[1]});
    let seat = await table.seats.call(0);
    assert.equal(seat[0], accounts[0], 'join failed.');
    seat = await table.seats.call(1);
    assert.equal(seat[0], accounts[1], 'join failed.');
    // create the leave receipt here.
    const leaveReceipt = new Receipt(table.address).leave(3, P0_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    seat = await table.seats.call(0);
    // reading the exitHand from hand
    assert.equal(seat[3].toNumber(), 3, 'leave request failed.');
    // prepare settlement
    var settleReceipt = new Receipt(table.address).settle(1, 3, [new BigNumber(-30000000000000), new BigNumber(25000000000000)]).sign(ORACLE_PRIV);
    await table.settle(...Receipt.parseToParams(settleReceipt));
    const lhn = await table.lastHandNetted.call();
    assert.equal(lhn.toNumber(), 3, 'settlement failed for last hand.');
    seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), 0, 'settlement failed for seat pos 1.');
    assert.equal(seat[0], P_EMPTY, 'payout failed.');
    seat = await table.seats.call(1);
    assert.equal(seat[1].toNumber(), 125000, 'settlement failed for seat pos 2.');
  });

  it('should join table, then net, then leave.', async () => {

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

    const token = await Token.new();
    const table = await Table.new(token.address, ORACLE, 2000000000000, 2);
    await token.transfer(accounts[1], 100000000000000);
    await token.transData(table.address, 100000000000000, '0x00' + P0_ADDR);
    await token.transData(table.address, 100000000000000, '0x01' + P1_ADDR, {from: accounts[1]});

    await table.submitDists('0x' + dist40, '0x' + distSig40);
    var bets4 = '0x' + bet41 + bet42 + bet411;
    var betSigs4 = '0x' + betSig41 + betSig42 + betSig411;
    await table.submitBets(bets4, betSigs4);
    let inVal = await table.getIn.call(4, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), 15000, 'bet submission failed.');
    inVal = await table.getIn.call(4, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), 17000, 'bet submission failed.');
    let outVal = await table.getOut.call(4, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 17000, 'dist submission failed.');
    outVal = await table.getOut.call(4, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), 15000, 'dist submission failed.');

    var dists = '0x' + dist40 + dist50 + dist51 + dist61 + dist60;
    var distSigs = '0x' + distSig40 + distSig50 + distSig51 + distSig61 + distSig60;
    await table.submitDists(dists, distSigs);
    var bets = '0x' + bet41 + bet42 + bet411 + bet51 + bet52 + bet61 + bet62;
    var betSigs = '0x' + betSig41 + betSig42 + betSig411 + betSig51 + betSig52 + betSig61 + betSig62;
    await table.submitBets(bets, betSigs);
    
    inVal = await table.getIn.call(5, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');
    inVal = await table.getIn.call(5, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');
    outVal = await table.getOut.call(5, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 40000, 'dist submission failed.');
    outVal = await table.getOut.call(5, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');

    inVal = await table.getIn.call(6, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), 12000, 'bet submission failed.');
    inVal = await table.getIn.call(6, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');

    outVal = await table.getOut.call(6, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(6, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), 32000, 'dist submission failed.');
    // make leave receipt
    const leaveReceipt = new Receipt(table.address).leave(7, P1_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    const lnr = await table.lastNettingRequestHandId.call();
    assert.equal(lnr.toNumber(), 7, 'leave request failed.');
    await table.netHelp((Date.now() / 1000 | 0) + 61 * 10);
    const lhn = await table.lastHandNetted.call();
    assert.equal(lhn.toNumber(), 7, 'settlement failed.');

    // 300000 buyin + 2000 (hand3) + 20000 (hand4) - 12000 = 310000
    let seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), 110000, 'settlement failed.');
    // rebuy with account 0
    await token.transData(table.address, 100000000000000, '0x00' + P0_ADDR);
    seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), 210000, 'settlement failed.');

    seat = await table.seats.call(1);
    assert.equal(seat[1].toNumber(), 0, 'payout failed.');
  });

  it('should not accept distributions that spend more than bets.');

  it('should prevent bets that spend more than estimated balance.');

  it('should test receiptAddr different from senderAddress');

});
