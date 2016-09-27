contract('Table', function(accounts) {

  it("should join table with min buyIn.", function(done) {

    var token = Token.deployed();
    var table;
    var watcher;

    Table.new(token.address, '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74', 4000, 8000, 6).then(function(contract) {
      table = contract;
      watcher = contract.Join();
      return table.minBuyIn.call();
    }).then(function(buyIn) {
      return table.join(buyIn, "test");
    }).then(function(txHash){
      return table.seats.call(0);
    }).then(function(seat){
      assert.equal(seat[0], accounts[0], 'join failed.');
    }).then(done).catch(done);

  });

  it("should join table, then settle, then leave.", function(done) {

    var token = Token.deployed();
    var table;

    Table.new(token.address, '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74', 300000, 600000, 2).then(function(contract) {
      table = contract;
      return table.minBuyIn.call();
    }).then(function(buyIn) {
      return table.join(buyIn, "test", {from: accounts[0]});
    }).then(function(){
      return table.join(355360, "test2", {from: accounts[1]});
    }).then(function(txHash){
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[0], accounts[1], 'join failed.');
      var leaveReceipt = '0xf29953b70000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e10f3d125e5f4c753a6456fc37123cf17c6900f235708bb835136cb327d4c916e2567f78eff166027c389112d9360cfe5312e7c65ed04ebbfe7b2205dc75d1c1fd816214db7cca8a3d7fac024cad9c60d48df82b1b';
      return table.leave(leaveReceipt);
    }).then(function(txHash){
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[2], 3, 'leave request failed.');
      var settlement = '0x1a3c35ac000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000002f3beac30c498d9e26865f34fcaa57dbb935b0d74000000000000000000050000e10f3d125e5f4c753a6456fc37123cf17c6900f2000000000000000000050000';
      var sigs = '0x3ffebe7b4638be2537c14ab975e25780e20c82f206c6e3c680d2e428e3f7bf3e2aa53c9f5c4049728888701c3fd657b1ed1a35fe25fa41c6763b0c8c937be56a1b0d6c83efda8c323a5dfac0c98f46ea7256307614b5a37af4ca03820cde6fd0d422dc19b5da3531a95f8874c5518540d89a86020a6a24bb406d43f68613c1d4251b';
      return table.settle(settlement, sigs);
    }).then(function(txHash){
      return table.lastHandNetted.call();
    }).then(function(lastHand){
      assert.equal(lastHand, 3, 'settlement failed.');
    }).then(function(seat){
      return table.seats.call(0);
    }).then(function(seat){
      assert.equal(seat[1], 327680, 'settlement failed.');
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[1], 327680, 'settlement failed.');
      return table.payout({from: accounts[1]});
    }).then(function(txHash){
      return table.seats.call(1);
    }).then(function(seat){
      assert.equal(seat[1], 0, 'payout failed.');
    }).then(done).catch(done);

  });

  it("should join table, then net, then leave.");

});
