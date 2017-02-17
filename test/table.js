contract('Table', function(accounts) {

  it("should join table, then settle, then leave.", function(done) {

    var token = Token.deployed();
    var table;

    Table.new(token.address, '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74', 5000, 2).then(function(contract) {
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
      return table.join(300000, accounts[0], 1, "test", {from: accounts[0]});
    }).then(function(){
      return token.approve(table.address, 1000000, {from: accounts[1]});
    }).then(function(txHash){
      return table.join(355360, accounts[1], 2, "test2", {from: accounts[1]});
    }).then(function(txHash){
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[0], accounts[0], 'join failed.');
      return table.seats.call(2);
    }).then(function(seat){
      assert.equal(seat[0], accounts[1], 'join failed.');
      //leave(uint handId, address addr)
      var leaveReceipt = '0xf29953b70000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e10f3d125e5f4c753a6456fc37123cf17c6900f235708bb835136cb327d4c916e2567f78eff166027c389112d9360cfe5312e7c65ed04ebbfe7b2205dc75d1c1fd816214db7cca8a3d7fac024cad9c60d48df82b1b';
      return table.leave(leaveReceipt);
    }).then(function(txHash){
      return table.seats.call(2);
    }).then(function(seat){
      // reading the lastHand from hand
      assert.equal(seat[3].toNumber(), 3, 'leave request failed.');
      var settlement = '0x1a3c35ac000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000002f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000050000e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000050000';
      var sigs = '0x3ffebe7b4638be2537c14ab975e25780e20c82f206c6e3c680d2e428e3f7bf3e2aa53c9f5c4049728888701c3fd657b1ed1a35fe25fa41c6763b0c8c937be56a1b0d6c83efda8c323a5dfac0c98f46ea7256307614b5a37af4ca03820cde6fd0d422dc19b5da3531a95f8874c5518540d89a86020a6a24bb406d43f68613c1d4251b';
      return table.settle(settlement, sigs);
    }).then(function(txHash){
      return table.lastHandNetted.call();
    }).then(function(lastHand){
      assert.equal(lastHand, 3, 'settlement failed.');
    }).then(function(seat){
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[1], 327680, 'settlement failed.');
      return table.seats.call(2);
    }).then(function(seat){
      assert.equal(seat[1], 327680, 'settlement failed.');
      return table.payout({from: accounts[1]});
    }).then(function(txHash){
      return table.seats.call(2);
    }).then(function(seat){
      assert.equal(seat[1], 0, 'payout failed.');
    }).then(done).catch(done);

  });

  it('should join table, then net, then leave.', function(done) {

    var token = Token.deployed();
    var table;

    //bet 12000 pl_1 hand 1
    var bet11 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000002ee0';
    var betSig11 = '9e4b75e3d5891e4f849712cdbcab47c10b658d8dd7c176903118b5b0a49f2212162d4341f65d6938014f40df57d9b48feaac87fe3e5f3ad32f0d0f5bdcca809a1b';
    //bet 15000 pl_1 hand 1
    var bet111 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000003a98';
    var betSig111 = 'c7be8d2cf07b184b56682b908080b76286607feca99244cdfc56f74af2a8ad0d2eca01ce5ba780244032499466db46360260b625215736109df0a94bbef831871c';
    //bet 17000 pl_2 hand 1
    var bet12 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000004268';
    var betSig12 = '19742fb2b5fc6ee2ca3073de317873b7773104f399aac925e2756a9e0d25b77c6e690481ec40c20b6d984ceec5a623f926ea5ad26b9b7e27958833204664e7cf1c';
    //dist switch hand 1 claim 0
    var dist10 = '9dd00b590000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000004268e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000003a98';
    var distSig10 = '07d79dd020383dc36227003623e24e86a7186e596cf76f4ea2ff29e3101d60b17268d9394581ba5a2ba8dd877e8e1040ec6a5e26d3eb1ddba6c7ffde97a63d911c';


    //bet 20000 pl_1 hand 2
    var bet21 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000004e20';
    var betSig21 = '68339f697f8db709243ce7864bb022bb98fe92b781a4ffa0982c48449e8286283c1f460645af8504a1b1c045a8eb0ed0bf9cd3a8f4e3c58819f7ab2afd4915cb1c';
    //bet 20000 pl_2 hand 2
    var bet22 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000004e20';
    var betSig22 = '29a0316f84883dfe7f5ca16e9db569a3c28b24188614956d8a108400c3e7dc3201e944e6c3fb6cfefdcd537a606dac200ccb7d290aba200dcab5d9fabe2a1b731c';
    //dist pl_2 winns all hand 2 claim 0
    var dist20 = '9dd00b590000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000009c40f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000000000';
    var distSig20 = '4a9d2c4133d42551977dc83feb772c447758d141a168dc855d467bc22252eb9e33997ddf3c2c214705c19b3f101d3827070f2efa950a7842c08299da171ba15d1c';
    //dist pl_1 winns all hand 2 claim 1
    var dist21 = '9dd00b590000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000000000f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000009c40';
    var distSig21 = '6c1f811e8f2050f0e17bc4364cfb73b958bb65629726ecd275450ce1aecb57bd1e4794cf3abda951a7fb62d47330cdb002e775cf352702bb60ffd46c720b3c791c';

    //bet 12000 pl_1 hand 3
    var bet31 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000002ee0';
    var betSig31 = '974a7ad933ae11ca1956be38291675766d19dcdf5e29dd3c9f7d8ffabe1f162f635321c942ff807a91714f6200dd162e7b84eb159fe426071f0050c485bad39f1c';
    //bet 20000 pl_2 hand 3
    var bet32 = '6ffcc71900000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000004e20';
    var betSig32 = '17cc1950be26559f6138ced431c6722865d8714d300852b6e808e3592305fda2277264c5fe79b562f923fd3b61df7972e9f5d171c7d09cbdfea1811510adbd3a1c';
    //dist pl_2 wins all hand 3 claim 1
    var dist31 = '9dd00b590000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000007d00f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000000000';
    var distSig31 = 'ea9ddb7e2ae38e1104eca504bbff8f3a4db0d2292de05819486b6091feb326b20299e42dbf5ca6150967779a5e939b181ff4181249621df746441f412e24bc5b1c';
    //dist pl_1 winns all hand 3 claim 0
    var dist30 = '9dd00b590000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000000000f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000007d00';
    var distSig30 = '104f74c2b8ca22e98020e1063fc49026e5f08831816e55434761d154ba38309e2e7f315fdce7ec0097b16faad3fb0527a8073fe0c3740d2e832a423df63e066f1c';


    Table.new(token.address, '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74', 5000, 2).then(function(contract) {
      table = contract;
      return table.smallBlind.call();
    }).then(function(blind) {
      assert.equal(blind.toNumber(), 5000, 'config failed.');
      return token.approve(table.address, 300000, {from: accounts[0]});
    }).then(function(txHash){
      return table.join(300000, accounts[0], 1, "test", {from: accounts[0]});
    }).then(function(){
      return token.approve(table.address, 400000, {from: accounts[1]});
    }).then(function(txHash){
      return table.join(355360, accounts[1], 2, "test2", {from: accounts[1]});
    }).then(function(txHash){

      return table.submitDists('0x' + dist10, '0x' + distSig10);
    }).then(function(txHash){
      var bets1 = '0x' + bet11 + bet12 + bet111;
      var betSigs1 = '0x' + betSig11 + betSig12 + betSig111;
      return table.submitBets(bets1, betSigs1);
    }).then(function(txHash){

      return table.getIn.call(1, accounts[0]);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 15000, 'bet submission failed.');
      return table.getIn.call(1, accounts[1]);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 17000, 'bet submission failed.');

      return table.getOut.call(1, accounts[0]);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 17000, 'dist submission failed.');
      return table.getOut.call(1, accounts[1]);
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

      return table.getIn.call(2, accounts[0]);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');
      return table.getIn.call(2, accounts[1]);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');

      return table.getOut.call(2, accounts[0]);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 40000, 'dist submission failed.');
      return table.getOut.call(2, accounts[1]);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');

      return table.getIn.call(3, accounts[0]);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 12000, 'bet submission failed.');
      return table.getIn.call(3, accounts[1]);
    }).then(function(inVal){
      assert.equal(inVal.toNumber(), 20000, 'bet submission failed.');

      return table.getOut.call(3, accounts[0]);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 0, 'dist submission failed.');
      return table.getOut.call(3, accounts[1]);
    }).then(function(outVal){
      assert.equal(outVal[0].toNumber(), 32000, 'dist submission failed.');

      var leaveReceipt = '0xf29953b70000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e10f3d125e5f4c753a6456fc37123cf17c6900f235708bb835136cb327d4c916e2567f78eff166027c389112d9360cfe5312e7c65ed04ebbfe7b2205dc75d1c1fd816214db7cca8a3d7fac024cad9c60d48df82b1b';
      return table.leave(leaveReceipt);
    }).then(function(txHash){
      return table.lastNettingRequestHandId.call();
    }).then(function(lastNettingRequestHandId){
      assert.equal(lastNettingRequestHandId.toNumber(), 3, 'leave request failed.');
      return table.netHelp((Date.now() / 1000 | 0) + 61 * 10);
    }).then(function(txHash){
      return table.lastHandNetted.call();
    }).then(function(lastHand){
      assert.equal(lastHand.toNumber(), 3, 'settlement failed.');
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
