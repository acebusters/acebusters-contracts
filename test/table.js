contract('Table', function(accounts) {

  it("should join table with min buyIn.", function(done) {
    
    var token = Token.deployed();
    var table;

    Table.new(token.address, '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74', 4000, 8000, 6).then(function(contract) {
      table = contract;
      return table.minBuyIn.call();
    }).then(function(buyIn) {
      return table.join(buyIn);
    }).then(function(){
      return table.active.call(0);
    }).then(function(pos){
      return table.participants.call(pos);
    }).then(function(part){
      assert.equal(part[0], accounts[0], 'join failed.');
    }).then(done).catch(done);
  });

  it("should take receipts and distributions, then close hand", function(done) {
    
    var token = Token.deployed();
    var table;
    var player = '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74';
    var oracle = '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74';
    //receipt of 1000 to hand 1 from 0xf3
    var rec = '0x00000000000000000000000000000003e800000000000000000000000000011c4bd835e6bf5acfcba4bb94f89919e2d7abe406907c1c331dfb4e19632447c75e4b1663e43576bfa54ef1336774f9de8a4806535c6f833934e66c420239593615';
    //distribution of 500 in hand 1 to 0xf3
    var dist = '0x0000000000000000000000000001001c54aa45719d28f2ffab6a2c89972922bc8833cecd66cf9910184b2a490022560b65909808db5f95ffa6f5db7fb1cffe33eb1acf05dedf1f412035f3ce7082ceb601f3beac30c498d9e26865f34fcaa57dbb935b0d740000000000000000000001f4';

    Table.new(token.address, player, 4000, 8000, 0).then(function(contract) {
      table = contract;
      return table.report(1, rec);
    }).then(function() {
      return table.getReceipts.call(1);
    }).then(function(rec) {
      assert.equal(rec[0][0].toNumber(), 1000, 'amount missmatch');
      assert.equal(rec[1][0], player, 'signer missmatch');
      return table.claim(1, dist);
    }).then(function() {
      return table.getDist.call(1);
    }).then(function(dist) {
      assert.equal(dist[0].toNumber(), 1, 'handId missmatch');
      return table.withdraw();
    }).then(function() {
      return table.getWin.call(1, player);
    }).then(function(dist) {
      assert.equal(dist.toNumber(), -500, 'hand netting error');
    }).then(done).catch(done);
  });
});
