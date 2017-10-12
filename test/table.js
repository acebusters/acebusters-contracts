import { Receipt } from 'poker-helper';
import ethUtil from 'ethereumjs-util';
import BigNumber from 'bignumber.js';
var Token = artifacts.require('../contracts/ERC223BasicToken.sol');
var Table = artifacts.require('../contracts/Table.sol');
const assertJump = require('./helpers/assertJump');
const NTZ_DECIMALS = new BigNumber(10).pow(12);
const babz = (ntz) => NTZ_DECIMALS.mul(ntz);

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
    const table = await Table.new(token.address, ORACLE, 2000000000000, 2, 0);
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
    const settleReceipt = new Receipt(table.address).settle(1, 3, [babz(9), new BigNumber(-10000000000000)]).sign(ORACLE_PRIV);
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

  it("should join and immediately leave.", async () => {
    const token = await Token.new();
    const table = await Table.new(token.address, ORACLE, 2000000000000, 2, 0);
    await token.transData(table.address, 100000000000000, '0x00' + P0_ADDR);
    let seat = await table.seats.call(0);
    assert.equal(seat[0], accounts[0], 'join failed.');
    // create the leave receipt here.
    const leaveReceipt = new Receipt(table.address).leave(1, P0_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), 0, 'payout failed.');
  });

  it("should settling 0 hands.", async () => async () => {
    const token = await Token.new();
    const table = await Table.new(token.address, ORACLE, babz(1), 2);
    // wrong settlement between hand 1 and 1, should throw
    var settleReceipt = new Receipt(table.address).settle(1, 1, [0, 0]).sign(ORACLE_PRIV);
    try {
      await table.settle(...Receipt.parseToParams(settleReceipt));
    } catch (err) {
      assertJump(err);
    }
    assert(false, 'should have thrown');
  });

  it("should join table, then settle, then leave broke.", async () => {
    const token = await Token.new();
    const table = await Table.new(token.address, ORACLE, babz(1), 2, 0);
    await token.transfer(accounts[1], babz(40));
    await token.transData(table.address, babz(40), '0x00' + P0_ADDR);
    await token.transData(table.address, babz(40), '0x01' + P1_ADDR, {from: accounts[1]});
    let seat = await table.seats.call(0);
    assert.equal(seat[0], accounts[0], 'join failed.');
    seat = await table.seats.call(1);
    assert.equal(seat[0], accounts[1], 'join failed.');
    // create the leave receipt here.
    const leaveReceipt = new Receipt(table.address).leave(3, P1_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    seat = await table.seats.call(1);
    // reading the exitHand from hand
    assert.equal(seat[3].toNumber(), 3, 'leave request failed.');
    // prepare settlement
    var settleReceipt = new Receipt(table.address).settle(1, 3, [new BigNumber(39200000000000), babz(-40)]).sign(ORACLE_PRIV);
    await table.settle(...Receipt.parseToParams(settleReceipt));
    const lhn = await table.lastHandNetted.call();
    assert.equal(lhn.toNumber(), 3, 'settlement failed for last hand.');
    seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), new BigNumber(79200000000000), 'settlement failed for seat pos 0.');
    // check player 1 left table and has 0 balance token contract
    seat = await table.seats.call(1);
    assert.equal(seat[0], P_EMPTY, 'payout failed.');
    assert.equal(seat[1].toNumber(), 0, 'settlement failed for seat pos 1.');
    const bal = await token.balanceOf.call(accounts[1]);
    assert.equal(bal.toNumber(), 0);
  });

  it('should join table, then net, then leave.', async () => {
    const token = await Token.new();
    const table = await Table.new(token.address, ORACLE, babz(20), 2, 0);

    await token.transfer(accounts[1], babz(1000));
    await token.transData(table.address, babz(1000), '0x00' + P0_ADDR);
    await token.transData(table.address, babz(1000), '0x01' + P1_ADDR, {from: accounts[1]});
    // make leave receipt
    const leaveReceipt = new Receipt(table.address).leave(6, P1_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    const lnr = await table.lastNettingRequestHandId.call();
    assert.equal(lnr.toNumber(), 6, 'leave request failed.');


    // submit hand 4
    // bet 120 NTZ p_0 hand 4
    var bet41 = new Receipt(table.address).bet(4, babz(120)).sign(P0_PRIV);
    // bet 150 NTZ p_0 hand 4
    const bet411 = new Receipt(table.address).bet(4, babz(150)).sign(P0_PRIV);
    // bet 170 NTZ p_1 hand 4
    const bet42 = new Receipt(table.address).bet(4, babz(170)).sign(P1_PRIV);
    // dist hand 4 claim 0 - 310 for p_1
    const dist40 = new Receipt(table.address).dist(4, 0, [new BigNumber(0), babz(310)]).sign(ORACLE_PRIV);
    let hand4 = [];
    hand4 = hand4.concat(Receipt.parseToParams(bet41));
    hand4 = hand4.concat(Receipt.parseToParams(bet411));
    hand4 = hand4.concat(Receipt.parseToParams(bet42));
    hand4 = hand4.concat(Receipt.parseToParams(dist40));

    await table.submit(hand4);

    // check hand 4
    let inVal = await table.getIn.call(4, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), babz(150).toNumber(), 'bet submission failed.');
    inVal = await table.getIn.call(4, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), babz(170).toNumber(), 'bet submission failed.');
    let outVal = await table.getOut.call(4, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(4, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), babz(310).toNumber(), 'dist submission failed.');


    // bet 200 p_0 hand 5
    const bet51 = new Receipt(table.address).bet(5, babz(200)).sign(P0_PRIV);
    // bet 200 p_1 hand 5
    const bet52 = new Receipt(table.address).bet(5, babz(200)).sign(P1_PRIV);
    // dist p_0 winns all hand 5 claim 1
    const dist51 = new Receipt(table.address).dist(5, 1, [babz(390), new BigNumber(0)]).sign(ORACLE_PRIV);

    // bet 120 p_0 hand 6
    const bet61 = new Receipt(table.address).bet(6, babz(120)).sign(P0_PRIV);
    // bet 200 p_1 hand 6
    const bet62 = new Receipt(table.address).bet(6, babz(200)).sign(P1_PRIV);
    // dist p_1 wins all hand 6 claim 1
    const dist61 = new Receipt(table.address).dist(6, 1, [new BigNumber(0), babz(310)]).sign(ORACLE_PRIV);
    // dist p_0 winns all hand 6 claim 0
    const dist60 = new Receipt(table.address).dist(6, 0, [babz(310), new BigNumber(0)]).sign(ORACLE_PRIV);

    // submit hand 5 and 6
    let hands = [];
    hands = hands.concat(Receipt.parseToParams(dist51));
    hands = hands.concat(Receipt.parseToParams(bet51));
    hands = hands.concat(Receipt.parseToParams(bet52));
    hands = hands.concat(Receipt.parseToParams(dist61));
    hands = hands.concat(Receipt.parseToParams(dist60));
    hands = hands.concat(Receipt.parseToParams(bet61));
    hands = hands.concat(Receipt.parseToParams(bet62));
    const writeCount = await table.submit.call(hands);
    assert.equal(writeCount.toNumber(), 6, 'not all receipt recognized');
    await table.submit(hands);

    // check hand 5 and 6
    inVal = await table.getIn.call(5, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(5, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');
    outVal = await table.getOut.call(5, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 390000000000000, 'dist submission failed.');
    outVal = await table.getOut.call(5, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');

    inVal = await table.getIn.call(6, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), 120000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(6, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');

    outVal = await table.getOut.call(6, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(6, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), 310000000000000, 'dist submission failed.');
    // net
    await table.net();
    const lhn = await table.lastHandNetted.call();
    assert.equal(lhn.toNumber(), 6, 'settlement failed.');

    // 1000 buyin - 150 (hand4) + 190 (hand5) - 120 (hand6) = 920
    let seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), babz(920).toNumber(), 'settlement failed.');
    // rebuy with account 0
    await token.transData(table.address, babz(1000).toNumber(), '0x00' + P0_ADDR);
    seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), babz(1920).toNumber(), 'settlement failed.');

    seat = await table.seats.call(1);
    assert.equal(seat[1].toNumber(), 0, 'payout failed.');
  });

  describe('#leave()', () => {
    it('should fail if player is already leaving', async() => {
      const token = await Token.new();
      const table = await Table.new(token.address, ORACLE, babz(20), 2, 0);

      await token.transfer(accounts[1], babz(1000));
      await token.transData(table.address, babz(1000), '0x00' + P0_ADDR);
      await token.transData(table.address, babz(1000), '0x01' + P1_ADDR, {from: accounts[1]});

      // make leave receipt
      let leaveReceipt = new Receipt(table.address).leave(6, P1_ADDR).sign(ORACLE_PRIV);
      await table.leave(...Receipt.parseToParams(leaveReceipt));

      try {
        await table.leave(...Receipt.parseToParams(leaveReceipt));
      } catch (err) {
        assertJump(err);
      }
    });
  });

  it('should not accept distributions that spend more than bets.');

  it('should prevent bets that spend more than estimated balance.');

  it('should test receiptAddr different from senderAddress');

});
