require('./helpers.js')()

contract('Table', function(accounts) {

  const P0_ADDR = '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74';
  const P0_PRIV = '0x278a5de700e29faae8e40e366ec5012b5ec63d36ec77e8a2417154cc1d25383f';

  const P1_ADDR = '0xe10f3d125e5f4c753a6456fc37123cf17c6900f2';
  const P1_PRIV = '0x7bc8feb5e1ce2927480de19d8bc1dc6874678c016ae53a2eec6a6e9df717bfac';

  const ORACLE = '0x82e8c6cf42c8d1ff9594b17a3f50e94a12cc860f';
  const ORACLE_PRIV = '0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4';

  it("should join table, then settle, then leave.", function(done) {

    var token = Token.deployed();
    var table;

    Table.new(token.address, ORACLE, 5000, 2).then(function(contract) {
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
      return table.join(300000, P0_ADDR, 1, "test", {from: accounts[0]});
    }).then(function(){
      return token.approve(table.address, 1000000, {from: accounts[1]});
    }).then(function(txHash){
      return table.join(355360, P1_ADDR, 2, "test2", {from: accounts[1]});
    }).then(function(txHash){
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[0], accounts[0], 'join failed.');
      return table.seats.call(2);
    }).then(function(seat){
      assert.equal(seat[0], accounts[1], 'join failed.');
      // create the leave receipt here. structure:
      // <12 bytes hand ID>
      // <20 bytes destination>
      // <20 bytes signer addr>
      // <32 r><32 s><1 v>
      var data = '0x000000000000000000000003'+table.address.replace('0x','')+P1_ADDR.replace('0x','');
      var sig = sign(ORACLE_PRIV, data);
      var leaveReceipt = data + sig.r.replace('0x','') + sig.s.replace('0x','') + sig.v.toString(16);
      return table.leave(leaveReceipt);
    }).then(function(txHash){
      return table.seats.call(2);
    }).then(function(seat){
      // reading the lastHand from hand
      assert.equal(seat[3].toNumber(), 3, 'leave request failed.');

      var settlement = '0x000000000000000000000003'+table.address.replace('0x','') + 'f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000050000e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000050000';
      var oSig = sign(ORACLE_PRIV, settlement);
      var sigs = '0x' + oSig.r.replace('0x','') + oSig.s.replace('0x','') + oSig.v.toString(16);
      return table.settle(settlement, sigs);
    }).then(function(txHash){
      return table.lastHandNetted.call();
    }).then(function(lastHand){
      assert.equal(lastHand, 3, 'settlement failed for last hand.');
    }).then(function(seat){
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 327680, 'settlement failed for seat pos 1.');
      return table.seats.call(2);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 327680, 'settlement failed for seat pos 2.');
      return table.payout({from: accounts[1]});
    }).then(function(txHash){
      return table.seats.call(2);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 0, 'payout failed.');
    }).then(done).catch(done);

  });

  it('should join table, then net, then leave.', function(done) {

    var token = Token.deployed();
    var table;

    //bet 12000 p_0 hand 1 12 + 12 + 4 + 20 
    var bet11 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000002ee0';
    var betSig11 = signStr(P0_PRIV, bet11);
    //bet 15000 p_0 hand 1
    var bet111 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000003a98';
    var betSig111 = signStr(P0_PRIV, bet111);
    //bet 17000 p_1 hand 1
    var bet12 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000004268';
    var betSig12 = signStr(P1_PRIV, bet12);
    //dist switch hand 1 claim 0
    var dist10 = '9dd00b590000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000004268e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000003a98';
    var distSig10 = signStr(ORACLE_PRIV, dist10);


    //bet 20000 p_0 hand 2
    var bet21 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000004e20';
    var betSig21 = signStr(P0_PRIV, bet21);
    //bet 20000 p_1 hand 2
    var bet22 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000004e20';
    var betSig22 = signStr(P1_PRIV, bet22);
    //dist p_1 winns all hand 2 claim 0
    var dist20 = '9dd00b590000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000009c40f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000000000';
    var distSig20 = signStr(P1_PRIV, dist20);
    //dist p_0 winns all hand 2 claim 1
    var dist21 = '9dd00b590000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000000000f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000009c40';
    var distSig21 = signStr(ORACLE_PRIV, dist21);

    //bet 12000 p_0 hand 3
    var bet31 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000002ee0';
    var betSig31 = signStr(P0_PRIV, bet31);
    //bet 20000 p_1 hand 3
    var bet32 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000004e20';
    var betSig32 = signStr(P1_PRIV, bet32);
    //dist p_1 wins all hand 3 claim 1
    var dist31 = '9dd00b590000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000007d00f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000000000';
    var distSig31 = signStr(ORACLE_PRIV, dist31);
    //dist p_0 winns all hand 3 claim 0
    var dist30 = '9dd00b590000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000000000f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000007d00';
    var distSig30 = signStr(ORACLE_PRIV, dist30);


    Table.new(token.address, ORACLE, 5000, 2).then(function(contract) {
      table = contract;
      return table.smallBlind.call();
    }).then(function(blind) {
      assert.equal(blind.toNumber(), 5000, 'config failed.');
      return token.approve(table.address, 300000, {from: accounts[0]});
    }).then(function(txHash){
      return table.join(300000, P0_ADDR, 1, "test", {from: accounts[0]});
    }).then(function(){
      return token.approve(table.address, 400000, {from: accounts[1]});
    }).then(function(txHash){
      return table.join(355360, P1_ADDR, 2, "test2", {from: accounts[1]});
    }).then(function(txHash){

      return table.submitDists('0x' + dist10, '0x' + distSig10);
    }).then(function(txHash){
      var bets1 = '0x' + bet11 + bet12 + bet111;
      var betSigs1 = '0x' + betSig11 + betSig12 + betSig111;
      return table.submitBets(bets1, betSigs1);
    }).then(function(txHash){

      return table.getIn.call(1, P0_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 15000, 'bet submission failed.');
      return table.getIn.call(1, P1_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 17000, 'bet submission failed.');

      return table.getOut.call(1, P0_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 17000, 'dist submission failed.');
      return table.getOut.call(1, P1_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 15000, 'dist submission failed.');

      var dists = '0x' + dist10 + dist20 + dist21 + dist31 + dist30;
      var distSigs = '0x' + distSig10 + distSig20 + distSig21 + distSig31 + distSig30;
      return table.submitDists(dists, distSigs);
    }).then(function(txHash){
      var bets = '0x' + bet11 + bet12 + bet111 + bet21 + bet22 + bet31 + bet32;
      var betSigs = '0x' + betSig11 + betSig12 + betSig111 + betSig21 + betSig22 + betSig31 + betSig32;
      return table.submitBets(bets, betSigs);
    }).then(function(txHash){

      return table.getIn.call(2, P0_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');
      return table.getIn.call(2, P1_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');

      return table.getOut.call(2, P0_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 40000, 'dist submission failed.');
      return table.getOut.call(2, P1_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');

      return table.getIn.call(3, P0_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 12000, 'bet submission failed.');
      return table.getIn.call(3, P1_ADDR);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');

      return table.getOut.call(3, P0_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
      return table.getOut.call(3, P1_ADDR);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 32000, 'dist submission failed.');

      var data = '0x000000000000000000000004'+table.address.replace('0x','')+P1_ADDR.replace('0x','');
      var sig = sign(ORACLE_PRIV, data);
      var leaveReceipt = data + sig.r.replace('0x','') + sig.s.replace('0x','') + sig.v.toString(16);
      return table.leave(leaveReceipt);
    }).then(function(txHash){
      return table.lastNettingRequestHandId.call();
    }).then(function(lastNettingRequestHandId){
      assert.equal(lastNettingRequestHandId.toNumber(), 4, 'leave request failed.');
      return table.netHelp((Date.now() / 1000 | 0) + 61 * 10);
    }).then(function(txHash){
      return table.lastHandNetted.call();
    }).then(function(lastHand){
      assert.equal(lastHand.toNumber(), 4, 'settlement failed.');
    }).then(function(seat){

      //300000 buyin + 2000 (hand1) + 20000 (hand2) - 12000 = 310000
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 310000, 'settlement failed.');

      //355360 buyin - 2000 (hand1) - 20000 (hand2) + 12000 = 345360
      return table.seats.call(2);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 345360, 'settlement failed.');
      return table.payout({from: accounts[1]});
    }).then(function(txHash){
      return table.seats.call(2);
    }).then(function(seat){
      assert.equal(seat[1].toNumber(), 0, 'payout failed.');
    }).then(done).catch(done);

  });

  it('should not accept distributions that spend more than bets.');

  it('should prevent bets that spend more than estimated balance.');

  it('should test receiptAddr different from senderAddress');

});
