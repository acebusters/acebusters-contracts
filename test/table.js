import { Receipt } from 'poker-helper';
import ethUtil from 'ethereumjs-util';
import BigNumber from 'bignumber.js';
var Token = artifacts.require('../contracts/ERC223BasicToken.sol');
var Table = artifacts.require('../contracts/Table.sol');

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
    assert.equal(seat[1].toNumber(), 109000000000000, 'settlement failed for seat pos 2.');
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
    assert.equal(seat[1].toNumber(), 125000000000000, 'settlement failed for seat pos 2.');
  });

  it('should join table, then net, then leave.', async () => {
    const token = await Token.new();
    const table = await Table.new(token.address, ORACLE, 20000000000000, 2);

    // bet 120 NTZ p_0 hand 4
    var bet41 = new Receipt(table.address).bet(4, new BigNumber(120000000000000)).sign(P0_PRIV);
    // bet 150 NTZ p_0 hand 4
    const bet411 = new Receipt(table.address).bet(4, new BigNumber(150000000000000)).sign(P0_PRIV);
    // bet 170 NTZ p_1 hand 4
    const bet42 = new Receipt(table.address).bet(4, new BigNumber(170000000000000)).sign(P1_PRIV);
    // dist hand 4 claim 0 - 310 for p_1
    const dist40 = new Receipt(table.address).dist(4, 0, [new BigNumber(0), new BigNumber(310000000000000)]).sign(ORACLE_PRIV);


    await token.transfer(accounts[1], 1000000000000000);
    await token.transData(table.address, 1000000000000000, '0x00' + P0_ADDR);
    await token.transData(table.address, 1000000000000000, '0x01' + P1_ADDR, {from: accounts[1]});

    // submit hand 4
    let hand4 = [];
    hand4 = hand4.concat(Receipt.parseToParams(bet41));
    hand4 = hand4.concat(Receipt.parseToParams(bet411));
    hand4 = hand4.concat(Receipt.parseToParams(bet42));
    hand4 = hand4.concat(Receipt.parseToParams(dist40));

    await table.submit(hand4);

    // check hand 4
    let inVal = await table.getIn.call(4, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), 150000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(4, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), 170000000000000, 'bet submission failed.');
    let outVal = await table.getOut.call(4, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(4, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), 310000000000000, 'dist submission failed.');


    // bet 200 p_0 hand 5
    const bet51 = new Receipt(table.address).bet(5, new BigNumber(200000000000000)).sign(P0_PRIV);
    // bet 200 p_1 hand 5
    const bet52 = new Receipt(table.address).bet(5, new BigNumber(200000000000000)).sign(P1_PRIV);
    // dist p_1 winns all hand 5 claim 0
    const dist50 = new Receipt(table.address).dist(5, 0, [new BigNumber(0), new BigNumber(390000000000000)]).sign(ORACLE_PRIV);
    // dist p_0 winns all hand 5 claim 1
    const dist51 = new Receipt(table.address).dist(5, 1, [new BigNumber(390000000000000), new BigNumber(0)]).sign(ORACLE_PRIV);

    // bet 120 p_0 hand 6
    const bet61 = new Receipt(table.address).bet(6, new BigNumber(120000000000000)).sign(P0_PRIV);
    // bet 200 p_1 hand 6
    const bet62 = new Receipt(table.address).bet(6, new BigNumber(200000000000000)).sign(P1_PRIV);
    // dist p_1 wins all hand 6 claim 1
    const dist61 = new Receipt(table.address).dist(6, 1, [new BigNumber(0), new BigNumber(310000000000000)]).sign(ORACLE_PRIV);
    // dist p_0 winns all hand 6 claim 0
    const dist60 = new Receipt(table.address).dist(6, 0, [new BigNumber(310000000000000), new BigNumber(0)]).sign(ORACLE_PRIV);

    // submit hand 5 and 6
    let hands = [];
    hands = hands.concat(Receipt.parseToParams(dist50));
    hands = hands.concat(Receipt.parseToParams(dist51));
    hands = hands.concat(Receipt.parseToParams(bet51));
    hands = hands.concat(Receipt.parseToParams(bet52));
    hands = hands.concat(Receipt.parseToParams(dist61));
    hands = hands.concat(Receipt.parseToParams(dist60));
    hands = hands.concat(Receipt.parseToParams(bet61));
    hands = hands.concat(Receipt.parseToParams(bet62));
    await table.submit(hands);
    
    // check hand 5 and 6
    inVal = await table.getIn.call(5, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(5, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');
    outVal = await table.getOut.call(5, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 390000000000000, 'dist submission failed.');
    outVal = await table.getOut.call(5, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), 390000000000000, 'dist submission failed.');

    inVal = await table.getIn.call(6, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), 120000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(6, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');

    outVal = await table.getOut.call(6, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(6, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), 310000000000000, 'dist submission failed.');
    // make leave receipt
    const leaveReceipt = new Receipt(table.address).leave(7, P1_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    const lnr = await table.lastNettingRequestHandId.call();
    assert.equal(lnr.toNumber(), 7, 'leave request failed.');
    console.log('bef');
    await table.netHelp((Date.now() / 1000 | 0) + 61 * 10);
    console.log('after');
    const lhn = await table.lastHandNetted.call();
    assert.equal(lhn.toNumber(), 7, 'settlement failed.');

    // 300000 buyin + 2000 (hand3) + 20000 (hand4) - 12000 = 310000
    let seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), 920000000000000, 'settlement failed.');
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
