import { Receipt } from 'poker-helper';
import {advanceBlock} from './helpers/advanceToBlock';
import ethUtil from 'ethereumjs-util';
import BigNumber from 'bignumber.js';
import increaseTime from './helpers/increaseTime';
var Table = artifacts.require('../contracts/SnGTable.sol');
const assertJump = require('./helpers/assertJump');
const NTZ_DECIMALS = new BigNumber(10).pow(12);
const babz = (ntz) => NTZ_DECIMALS.mul(ntz);

contract('SnGTable', function(accounts) {

  const P0_ADDR = 'f3beac30c498d9e26865f34fcaa57dbb935b0d74';
  const P0_PRIV = '0x278a5de700e29faae8e40e366ec5012b5ec63d36ec77e8a2417154cc1d25383f';

  const P1_ADDR = 'e10f3d125e5f4c753a6456fc37123cf17c6900f2';
  const P1_PRIV = '0x7bc8feb5e1ce2927480de19d8bc1dc6874678c016ae53a2eec6a6e9df717bfac';

  const P2_ADDR = '945caca63faeb3ef5eeb0dee173e28ad3b3aebcf';
  const P2_PRIV = '0x1fac0e0f4992ef1d9d3ddab29ea41dd9aa5f4007e9b7b663739ad7eeed77c3f0';

  const P3_ADDR = '3778622ae23d2696effe148035f1f53b896ad8fc';
  const P3_PRIV = '0x39aeb43da3514b6a5178e1076ce7cfcd7fa5183e01166d75c50717e517dcef4e';

  const P4_ADDR = '937b68214157e8c4d1dc1548e361099f0c066bf3';
  const P4_PRIV = '0x88e75f7aecf14e85ea576f536674e7c9fc6f1b76fae3cc0b4b14693687bd4614';

  const P5_ADDR = 'dde567242ed9d70eed542e04987192ee0e4333b6';
  const P5_PRIV = '0x39b1a0948ad9b0662cb1bb20888b60a7dfb161778000ca6d518aacefe51c1b67';

  const ORACLE = '0x82e8c6cf42c8d1ff9594b17a3f50e94a12cc860f';
  const ORACLE_PRIV = '0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4';

  const P_EMPTY = '0x0000000000000000000000000000000000000000';

  it("should start tournament with min 6 people, then settle, then leave.", async () => {
    await advanceBlock();
    const table = await Table.new(ORACLE, babz(2), 8, 0, 604800, 86400);
    let state = await table.state();
    assert.equal(state.toNumber(), 0);

    await increaseTime(86400 * 7);
    await table.tick();
    state = await table.state();

    assert.equal(state.toNumber(), 1);

    const blind = await table.smallBlind.call();
    assert.equal(blind.toNumber(), babz(2).toNumber(), 'config failed.');
    await table.join('0x00' + P0_ADDR, {from: accounts[0], value: babz(100)});
    await table.join('0x01' + P1_ADDR, {from: accounts[1], value: babz(100)});
    await table.join('0x02' + P2_ADDR, {from: accounts[2], value: babz(100)});
    await table.join('0x03' + P3_ADDR, {from: accounts[3], value: babz(100)});
    await table.join('0x04' + P4_ADDR, {from: accounts[4], value: babz(100)});
    await table.join('0x05' + P5_ADDR, {from: accounts[5], value: babz(100)});

    let seat = await table.seats.call(0);
    assert.equal(seat[0], accounts[0], 'join failed.');
    seat = await table.seats.call(1);
    assert.equal(seat[0], accounts[1], 'join failed.');
    seat = await table.seats.call(2);
    assert.equal(seat[0], accounts[2], 'join failed.');
    seat = await table.seats.call(3);
    assert.equal(seat[0], accounts[3], 'join failed.');
    seat = await table.seats.call(4);
    assert.equal(seat[0], accounts[4], 'join failed.');
    seat = await table.seats.call(5);
    assert.equal(seat[0], accounts[5], 'join failed.');

    await increaseTime(86400);

    await table.tick();
    state = await table.state();
    assert.equal(state.toNumber(), 2);

    // create the leave receipt here.
    const leaveReceipt = new Receipt(table.address).leave(3, P1_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    seat = await table.seats.call(1);
    assert.equal(seat[3].toNumber(), 3, 'leave request failed.');

    const settleReceipt = new Receipt(table.address).settle(1, 3, [babz(9), babz(-10), babz(9), babz(-10), babz(9), babz(-10)]).sign(ORACLE_PRIV);
    const oracleBalBefore = await web3.eth.getBalance(ORACLE);
    const balancePlayer1Before = await web3.eth.getBalance(accounts[0]);
    const balancePlayer2Before = await web3.eth.getBalance(accounts[1]);
    const balancePlayer3Before = await web3.eth.getBalance(accounts[2]);
    const balancePlayer4Before = await web3.eth.getBalance(accounts[3]);
    const balancePlayer5Before = await web3.eth.getBalance(accounts[4]);
    const balancePlayer6Before = await web3.eth.getBalance(accounts[5]);

    await table.settle(...Receipt.parseToParams(settleReceipt), {gasPrice: 0});

    const seat1 = await table.seats.call(0);
    const seat2 = await table.seats.call(1);
    const seat3 = await table.seats.call(2);
    const seat4 = await table.seats.call(3);
    const seat5 = await table.seats.call(4);
    const seat6 = await table.seats.call(5);
    const oracleBalAfter = await web3.eth.getBalance(ORACLE);
    const balancePlayer1After = await web3.eth.getBalance(accounts[0]);
    const balancePlayer2After = await web3.eth.getBalance(accounts[1]);
    const balancePlayer3After = await web3.eth.getBalance(accounts[2]);
    const balancePlayer4After = await web3.eth.getBalance(accounts[3]);
    const balancePlayer5After = await web3.eth.getBalance(accounts[4]);
    const balancePlayer6After = await web3.eth.getBalance(accounts[5]);
    const lhn = await table.lastHandNetted.call();
    assert.equal(lhn.toNumber(), 3, 'settlement failed for last hand.');
    assert.equal(oracleBalAfter.sub(oracleBalBefore).toNumber(), 3000000000000, 'withdraw rake failed.');

    assert.equal(seat1[1].toNumber(), 109000000000000, 'settlement failed for seat pos 1.');
    assert.equal(balancePlayer1After.sub(balancePlayer1Before).toNumber(), 0, 'payout failed for seat pos 1.');
    assert.equal(seat2[1].toNumber(), 0, 'payout failed.');
    assert.equal(balancePlayer2After.sub(balancePlayer2Before).toNumber(), 90000000000000, 'settlement failed for seat pos 2.');
    assert.equal(seat3[1].toNumber(), 109000000000000, 'payout failed.');
    assert.equal(balancePlayer3After.sub(balancePlayer3Before).toNumber(), 0, 'settlement failed for seat pos 3.');
    assert.equal(seat4[1].toNumber(), 90000000000000, 'payout failed.');
    assert.equal(balancePlayer4After.sub(balancePlayer4Before).toNumber(), 0, 'settlement failed for seat pos 4.');
    assert.equal(seat5[1].toNumber(), 109000000000000, 'payout failed.');
    assert.equal(balancePlayer5After.sub(balancePlayer5Before).toNumber(), 0, 'settlement failed for seat pos 5.');
    assert.equal(seat6[1].toNumber(), 90000000000000, 'payout failed.');
    assert.equal(balancePlayer6After.sub(balancePlayer6Before).toNumber(), 0, 'settlement failed for seat pos 6.');
  });

  it("should join and immediately leave.", async () => {
    await advanceBlock();
    const table = await Table.new(ORACLE, babz(2), 8, 0, 604800, 86400);
    let state = await table.state();
    assert.equal(state.toNumber(), 0);

    await increaseTime(86400 * 7);

    await table.tick();
    state = await table.state();
    assert.equal(state.toNumber(), 1);

    await table.join('0x00' + P0_ADDR, {from: accounts[0], value: babz(100)});
    let seat = await table.seats.call(0);
    assert.equal(seat[0], accounts[0], 'join failed.');
    // create the leave receipt here.
    const leaveReceipt = new Receipt(table.address).leave(1, P0_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), 0, 'payout failed.');
  });

  it("should not settle before Table State is in tournament", async () => async () => {
    await advanceBlock();
    const table = await Table.new(ORACLE, babz(2), 8, 0, 604800, 86400);
    let state = await table.state();
    assert.equal(state.toNumber(), 0);

    await increaseTime(86400 * 7);

    await table.tick();
    state = await table.state();
    assert.equal(state.toNumber(), 1);

    await table.join('0x00' + P0_ADDR, {from: accounts[0], value: babz(100)});
    let seat = await table.seats.call(0);
    assert.equal(seat[0], accounts[0], 'join failed.');
    // create the leave receipt here.
    const leaveReceipt = new Receipt(table.address).leave(1, P0_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), 0, 'payout failed.');
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
    await advanceBlock();
    const table = await Table.new(ORACLE, babz(1), 8, 0, 604800, 86400);
    let state = await table.state();
    assert.equal(state.toNumber(), 0);

    await increaseTime(86400 * 7);
    await table.tick();
    state = await table.state();

    assert.equal(state.toNumber(), 1);

    const blind = await table.smallBlind.call();
    assert.equal(blind.toNumber(), babz(1).toNumber(), 'config failed.');
    await table.join('0x00' + P0_ADDR, {from: accounts[0], value: babz(40)});
    await table.join('0x01' + P1_ADDR, {from: accounts[1], value: babz(40)});
    await table.join('0x02' + P2_ADDR, {from: accounts[2], value: babz(40)});
    await table.join('0x03' + P3_ADDR, {from: accounts[3], value: babz(40)});
    await table.join('0x04' + P4_ADDR, {from: accounts[4], value: babz(40)});
    await table.join('0x05' + P5_ADDR, {from: accounts[5], value: babz(40)});

    let seat = await table.seats.call(0);
    assert.equal(seat[0], accounts[0], 'join failed.');
    seat = await table.seats.call(1);
    assert.equal(seat[0], accounts[1], 'join failed.');
    seat = await table.seats.call(2);
    assert.equal(seat[0], accounts[2], 'join failed.');
    seat = await table.seats.call(3);
    assert.equal(seat[0], accounts[3], 'join failed.');
    seat = await table.seats.call(4);
    assert.equal(seat[0], accounts[4], 'join failed.');
    seat = await table.seats.call(5);
    assert.equal(seat[0], accounts[5], 'join failed.');

    await increaseTime(86400);

    await table.tick();
    state = await table.state();
    assert.equal(state.toNumber(), 2);

    // create the leave receipt here.
    const leaveReceipt = new Receipt(table.address).leave(3, P1_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    seat = await table.seats.call(1);
    assert.equal(seat[3].toNumber(), 3, 'leave request failed.');

    const settleReceipt = new Receipt(table.address).settle(1, 3, [babz(39.2*5), babz(-40), babz(-40), babz(-40), babz(-40), babz(-40)]).sign(ORACLE_PRIV);
    const oracleBalBefore = await web3.eth.getBalance(ORACLE);
    const balancePlayer1Before = await web3.eth.getBalance(accounts[0]);
    const balancePlayer2Before = await web3.eth.getBalance(accounts[1]);
    const balancePlayer3Before = await web3.eth.getBalance(accounts[2]);
    const balancePlayer4Before = await web3.eth.getBalance(accounts[3]);
    const balancePlayer5Before = await web3.eth.getBalance(accounts[4]);
    const balancePlayer6Before = await web3.eth.getBalance(accounts[5]);

    await table.settle(...Receipt.parseToParams(settleReceipt), {gasPrice: 0});

    const seat1 = await table.seats.call(0);
    const seat2 = await table.seats.call(1);
    const seat3 = await table.seats.call(2);
    const seat4 = await table.seats.call(3);
    const seat5 = await table.seats.call(4);
    const seat6 = await table.seats.call(5);
    const oracleBalAfter = await web3.eth.getBalance(ORACLE);
    const balancePlayer1After = await web3.eth.getBalance(accounts[0]);
    const balancePlayer2After = await web3.eth.getBalance(accounts[1]);
    const balancePlayer3After = await web3.eth.getBalance(accounts[2]);
    const balancePlayer4After = await web3.eth.getBalance(accounts[3]);
    const balancePlayer5After = await web3.eth.getBalance(accounts[4]);
    const balancePlayer6After = await web3.eth.getBalance(accounts[5]);
    const lhn = await table.lastHandNetted.call();
    assert.equal(lhn.toNumber(), 3, 'settlement failed for last hand.');
    assert.equal(oracleBalAfter.sub(oracleBalBefore).toNumber(), 4000000000000, 'withdraw rake failed.');

    assert.equal(seat1[1].toNumber(), 236000000000000, 'settlement failed for seat pos 1.');
    assert.equal(balancePlayer1After.sub(balancePlayer1Before).toNumber(), 0, 'payout failed for seat pos 1.');
    assert.equal(seat2[1].toNumber(), 0, 'payout failed.');
    assert.equal(balancePlayer2After.sub(balancePlayer2Before).toNumber(), 0, 'settlement failed for seat pos 2.');
    assert.equal(seat3[1].toNumber(), 0, 'payout failed.');
    assert.equal(balancePlayer3After.sub(balancePlayer3Before).toNumber(), 0, 'settlement failed for seat pos 3.');
    assert.equal(seat4[1].toNumber(), 0, 'payout failed.');
    assert.equal(balancePlayer4After.sub(balancePlayer4Before).toNumber(), 0, 'settlement failed for seat pos 4.');
    assert.equal(seat5[1].toNumber(), 0, 'payout failed.');
    assert.equal(balancePlayer5After.sub(balancePlayer5Before).toNumber(), 0, 'settlement failed for seat pos 5.');
    assert.equal(seat6[1].toNumber(), 0, 'payout failed.');
    assert.equal(balancePlayer6After.sub(balancePlayer6Before).toNumber(), 0, 'settlement failed for seat pos 6.');
  });

  it('should join table, then net, then leave.', async () => {
    await advanceBlock();
    const table = await Table.new(ORACLE, babz(20), 6, 0, 604800, 86400);
    let state = await table.state();
    assert.equal(state.toNumber(), 0);

    await increaseTime(86400 * 7);
    await table.tick();
    state = await table.state();

    assert.equal(state.toNumber(), 1);

    const blind = await table.smallBlind.call();
    assert.equal(blind.toNumber(), babz(20).toNumber(), 'config failed.');
    await table.join('0x00' + P0_ADDR, {from: accounts[0], value: babz(1000)});
    await table.join('0x01' + P1_ADDR, {from: accounts[1], value: babz(1000)});
    await table.join('0x02' + P2_ADDR, {from: accounts[2], value: babz(1000)});
    await table.join('0x03' + P3_ADDR, {from: accounts[3], value: babz(1000)});
    await table.join('0x04' + P4_ADDR, {from: accounts[4], value: babz(1000)});
    await table.join('0x05' + P5_ADDR, {from: accounts[5], value: babz(1000)});

    // leave receipt summitted by oracle BECAUSE p_1 broke after hand 6 (to be taken care of by the backend)
    const balancePlayer2Before = await web3.eth.getBalance(accounts[1]);
    const leaveReceipt = new Receipt(table.address).leave(6, P1_ADDR).sign(ORACLE_PRIV);
    await table.leave(...Receipt.parseToParams(leaveReceipt));
    const lnr = await table.lastNettingRequestHandId.call();
    assert.equal(lnr.toNumber(), 6, 'leave request failed.');

    await increaseTime(86400 * 1);
    await table.tick();

    // submit hand 4
    // bet 120 NTZ p_0 hand 4
    var bet41 = new Receipt(table.address).bet(4, babz(120)).sign(P0_PRIV);
    // bet 150 NTZ p_0 hand 4
    const bet411 = new Receipt(table.address).bet(4, babz(150)).sign(P0_PRIV);
    // bet 170 NTZ p_1 hand 4
    const bet42 = new Receipt(table.address).bet(4, babz(170)).sign(P1_PRIV);
    // bet 150 NTZ p_2 hand 4
    const bet43 = new Receipt(table.address).bet(4, babz(150)).sign(P2_PRIV);
    // bet 170 NTZ p_3 hand 4
    const bet44 = new Receipt(table.address).bet(4, babz(170)).sign(P3_PRIV);
    // bet 150 NTZ p_4 hand 4
    const bet45 = new Receipt(table.address).bet(4, babz(150)).sign(P4_PRIV);
    // bet 170 NTZ p_5 hand 4
    const bet46 = new Receipt(table.address).bet(4, babz(170)).sign(P5_PRIV);
    // dist hand 4 claim 0 - 310 for p_1
    const dist40 = new Receipt(table.address).dist(4, 0, [new BigNumber(0), babz(310), new BigNumber(0), babz(310), new BigNumber(0), babz(310)]).sign(ORACLE_PRIV);
    let hand4 = [];
    hand4 = hand4.concat(Receipt.parseToParams(bet41));
    hand4 = hand4.concat(Receipt.parseToParams(bet411));
    hand4 = hand4.concat(Receipt.parseToParams(bet42));
    hand4 = hand4.concat(Receipt.parseToParams(bet43));
    hand4 = hand4.concat(Receipt.parseToParams(bet44));
    hand4 = hand4.concat(Receipt.parseToParams(bet45));
    hand4 = hand4.concat(Receipt.parseToParams(bet46));
    hand4 = hand4.concat(Receipt.parseToParams(dist40));

    await table.submit(hand4);


    // check hand 4
    let inVal = await table.getIn.call(4, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), babz(150).toNumber(), 'bet submission failed.');
    inVal = await table.getIn.call(4, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), babz(170).toNumber(), 'bet submission failed.');
    inVal = await table.getIn.call(4, '0x' + P2_ADDR);
    assert.equal(inVal.toNumber(), babz(150).toNumber(), 'bet submission failed.');
    inVal = await table.getIn.call(4, '0x' + P3_ADDR);
    assert.equal(inVal.toNumber(), babz(170).toNumber(), 'bet submission failed.');
    inVal = await table.getIn.call(4, '0x' + P4_ADDR);
    assert.equal(inVal.toNumber(), babz(150).toNumber(), 'bet submission failed.');
    inVal = await table.getIn.call(4, '0x' + P5_ADDR);
    assert.equal(inVal.toNumber(), babz(170).toNumber(), 'bet submission failed.');

    let outVal = await table.getOut.call(4, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(4, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), babz(310).toNumber(), 'dist submission failed.');
    outVal = await table.getOut.call(4, '0x' + P2_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(4, '0x' + P3_ADDR);
    assert.equal(outVal[0].toNumber(), babz(310).toNumber(), 'dist submission failed.');
    outVal = await table.getOut.call(4, '0x' + P4_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(4, '0x' + P5_ADDR);
    assert.equal(outVal[0].toNumber(), babz(310).toNumber(), 'dist submission failed.');


    // bet 200 p_0 hand 5
    const bet51 = new Receipt(table.address).bet(5, babz(200)).sign(P0_PRIV);
    // bet 200 p_1 hand 5
    const bet52 = new Receipt(table.address).bet(5, babz(200)).sign(P1_PRIV);
    // bet 200 p_0 hand 5
    const bet53 = new Receipt(table.address).bet(5, babz(200)).sign(P2_PRIV);
    // bet 200 p_1 hand 5
    const bet54 = new Receipt(table.address).bet(5, babz(200)).sign(P3_PRIV);
    // bet 200 p_0 hand 5
    const bet55 = new Receipt(table.address).bet(5, babz(200)).sign(P4_PRIV);
    // bet 200 p_1 hand 5
    const bet56 = new Receipt(table.address).bet(5, babz(200)).sign(P5_PRIV);
    // dist p_0 winns all hand 5 claim 1
    const dist51 = new Receipt(table.address).dist(5, 1, [babz(390), new BigNumber(0), babz(390), new BigNumber(0), babz(390), new BigNumber(0)]).sign(ORACLE_PRIV);

    // bet 120 p_0 hand 6
    const bet61 = new Receipt(table.address).bet(6, babz(120)).sign(P0_PRIV);
    // bet 200 p_1 hand 6
    const bet62 = new Receipt(table.address).bet(6, babz(940)).sign(P1_PRIV);
    // bet 120 p_0 hand 6
    const bet63 = new Receipt(table.address).bet(6, babz(120)).sign(P2_PRIV);
    // bet 200 p_1 hand 6
    const bet64 = new Receipt(table.address).bet(6, babz(200)).sign(P3_PRIV);
    // bet 120 p_0 hand 6
    const bet65 = new Receipt(table.address).bet(6, babz(120)).sign(P4_PRIV);
    // bet 200 p_1 hand 6
    const bet66 = new Receipt(table.address).bet(6, babz(200)).sign(P5_PRIV);
    // dist p_1 wins all hand 6 claim 1
    const dist61 = new Receipt(table.address).dist(6, 1, [babz(1050), new BigNumber(0), new BigNumber(0), babz(310), new BigNumber(0), babz(310)]).sign(ORACLE_PRIV);
    // dist p_0 winns all hand 6 claim 0
    const dist60 = new Receipt(table.address).dist(6, 0, [babz(310), new BigNumber(0), babz(310), new BigNumber(0), babz(310), new BigNumber(0)]).sign(ORACLE_PRIV);

    // submit hand 5 and 6
    let hands = [];
    hands = hands.concat(Receipt.parseToParams(dist51));
    hands = hands.concat(Receipt.parseToParams(bet51));
    hands = hands.concat(Receipt.parseToParams(bet52));
    hands = hands.concat(Receipt.parseToParams(bet53));
    hands = hands.concat(Receipt.parseToParams(bet54));
    hands = hands.concat(Receipt.parseToParams(bet55));
    hands = hands.concat(Receipt.parseToParams(bet56));
    hands = hands.concat(Receipt.parseToParams(dist61));
    hands = hands.concat(Receipt.parseToParams(dist60));
    hands = hands.concat(Receipt.parseToParams(bet61));
    hands = hands.concat(Receipt.parseToParams(bet62));
    hands = hands.concat(Receipt.parseToParams(bet63));
    hands = hands.concat(Receipt.parseToParams(bet64));
    hands = hands.concat(Receipt.parseToParams(bet65));
    hands = hands.concat(Receipt.parseToParams(bet66));
    const writeCount = await table.submit.call(hands);
    assert.equal(writeCount.toNumber(), 18, 'not all receipt recognized');
    await table.submit(hands);

    // check hand 5
    inVal = await table.getIn.call(5, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(5, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(5, '0x' + P2_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(5, '0x' + P3_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(5, '0x' + P4_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(5, '0x' + P5_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');

    outVal = await table.getOut.call(5, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 390000000000000, 'dist submission failed.');
    outVal = await table.getOut.call(5, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(5, '0x' + P2_ADDR);
    assert.equal(outVal[0].toNumber(), 390000000000000, 'dist submission failed.');
    outVal = await table.getOut.call(5, '0x' + P3_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(5, '0x' + P4_ADDR);
    assert.equal(outVal[0].toNumber(), 390000000000000, 'dist submission failed.');
    outVal = await table.getOut.call(5, '0x' + P5_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');

    // check hand 6
    inVal = await table.getIn.call(6, '0x' + P0_ADDR);
    assert.equal(inVal.toNumber(), 120000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(6, '0x' + P1_ADDR);
    assert.equal(inVal.toNumber(), 940000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(6, '0x' + P2_ADDR);
    assert.equal(inVal.toNumber(), 120000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(6, '0x' + P3_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(6, '0x' + P4_ADDR);
    assert.equal(inVal.toNumber(), 120000000000000, 'bet submission failed.');
    inVal = await table.getIn.call(6, '0x' + P5_ADDR);
    assert.equal(inVal.toNumber(), 200000000000000, 'bet submission failed.');

    outVal = await table.getOut.call(6, '0x' + P0_ADDR);
    assert.equal(outVal[0].toNumber(), 1050000000000000, 'dist submission failed.');
    outVal = await table.getOut.call(6, '0x' + P1_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(6, '0x' + P2_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(6, '0x' + P3_ADDR);
    assert.equal(outVal[0].toNumber(), 310000000000000, 'dist submission failed.');
    outVal = await table.getOut.call(6, '0x' + P4_ADDR);
    assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
    outVal = await table.getOut.call(6, '0x' + P5_ADDR);
    assert.equal(outVal[0].toNumber(), 310000000000000, 'dist submission failed.');

    // net
    await table.net();
    const lhn = await table.lastHandNetted.call();
    assert.equal(lhn.toNumber(), 6, 'settlement failed.');

    // 1000 buyin - 150 (hand4) + 190 (hand5) + 930 (hand6) = 1970
    let seat = await table.seats.call(0);
    assert.equal(seat[1].toNumber(), babz(1970).toNumber(), 'settlement failed.');

    // 1000 buyin - 150 (hand4) + 190 (hand5) - 120 (hand6) = 920
    seat = await table.seats.call(2);
    assert.equal(seat[1].toNumber(), babz(920).toNumber(), 'settlement failed.');

    // 1000 buyin + 140 (hand4) - 200 (hand5) + 110 (hand6) = 1050
    seat = await table.seats.call(3);
    assert.equal(seat[1].toNumber(), babz(1050).toNumber(), 'settlement failed.');

    // 1000 buyin - 150 (hand4) + 190 (hand5) - 120 (hand6) = 920
    seat = await table.seats.call(4);
    assert.equal(seat[1].toNumber(), babz(920).toNumber(), 'settlement failed.');

    // 1000 buyin + 140 (hand4) - 200 (hand5) + 110 (hand6) = 1050
    seat = await table.seats.call(5);
    assert.equal(seat[1].toNumber(), babz(1050).toNumber(), 'settlement failed.');

    // try rebuy
    try {
      await table.join('0x00' + P0_ADDR, {from: accounts[0], value: babz(1000)});
    } catch (error) {
      assertJump(error);
      seat = await table.seats.call(0);
      assert.equal(seat[1].toNumber(), babz(1970).toNumber(), 'buy in possible.');
    }

    seat = await table.seats.call(1);
    assert.equal(seat[1].toNumber(), 0, 'payout failed.');

    // no payout made to broke player
    const balancePlayer2After = await web3.eth.getBalance(accounts[1]);
    assert.equal(balancePlayer2Before.sub(balancePlayer2After).toNumber(), 0, 'player was not broke.');
  });


  it('should not accept distributions that spend more than bets.');

  it('should prevent bets that spend more than estimated balance.');

  it('should test receiptAddr different from senderAddress');

});
