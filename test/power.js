contract('Power', function(accounts) {

  it("should allow to power up and power down.", function(done) {

    var power = Power.deployed();
    var token;
    var downtime = 12*7*24*3600; // 3 month

    Token.new(accounts[0], 2, power.address).then(function(contract) {
      token = contract;
      return power.configure(accounts[3], token.address, downtime);
    }).then(function() {  
      return token.issue(1000);
    }).then(function() {
      return token.transfer(power.address, 500);
    }).then(function() {
      return power.balanceOf.call(accounts[0]);
	}).then(function(bal) {
      assert.equal(bal.toNumber(), 1000, 'power up failed');
      return power.totalSupply.call();
	}).then(function(total) {
      assert.equal(total.toNumber(), 2000, 'economy failed, 1000 power expected.');
      return token.issue(1000);
    }).then(function() {
      return token.transfer(accounts[3], 1000);
    }).then(function() {
      return token.transfer(power.address, 1000, {from: accounts[3]});
    }).then(function() {
      return power.down(200);
    }).then(function() {
      return power.downTickTest(0, (Date.now() / 1000 | 0) + downtime);
    }).then(function() {
      return power.balanceOf.call(accounts[0]);
	}).then(function(bal) {
      assert.equal(bal.toNumber(), 800, 'power down failed');
      return token.balanceOf.call(accounts[0]);
	}).then(function(bal) {
      assert.equal(bal.toNumber(), 700, 'power down failed');
      return token.totalSupply.call();
    }).then(function(totalSupply) {
    	assert.equal(totalSupply.toNumber(), 2000, 'config failed.');
    }).then(done).catch(done);
  });
});