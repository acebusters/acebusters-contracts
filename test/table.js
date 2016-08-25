contract('Table', function(accounts) {
  it("should join table with min buyIn.", function(done) {
    
    var token = Token.deployed();
    var table;

    Table.new(token.address, 4000, 8000, 6).then(function(contract) {
      table = contract;
     return token.balanceOf.call(accounts[0]);
    }).then(function(bal){
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
});
