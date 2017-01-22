contract('Token', function(accounts) {

  var promisify = function(watcher){
    return new Promise(function(resolve, reject) {
      watcher.get(function(e, a) {
        if (e)
          reject(e);
        else
          resolve(a);
      });
    });
  };

  var bytes32 = function(number) {
    var zeros = '000000000000000000000000000000000000000000000000000000000000000';
    var hexNumber = number.toString(16);
    return '0x' + (zeros + hexNumber).substring(hexNumber.length - 1);
  };

  var UINT_256_MINUS_3 = '1.15792089237316195423570985008687907853269984665640564039457584007913129639933e+77';
  var UINT_256_MINUS_2 = '1.15792089237316195423570985008687907853269984665640564039457584007913129639934e+77';
  var UINT_256_MINUS_1 = '1.15792089237316195423570985008687907853269984665640564039457584007913129639935e+77';
  var UINT_256 = '1.15792089237316195423570985008687907853269984665640564039457584007913129639936e+77';
  var UINT_255_MINUS_1 = '5.7896044618658097711785492504343953926634992332820282019728792003956564819967e+76';
  var UINT_255 = '5.7896044618658097711785492504343953926634992332820282019728792003956564819968e+76';

  var BYTES_32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  var BITS_257 = '0x10000000000000000000000000000000000000000000000000000000000000000';
  var BASE_UNIT = 2;
  var VALUE = 1001;

  it('should allow to change owner only by owner.', function(done) {
    var owner = accounts[0];
    var watcher, token;
    Token.new(owner, 2).then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.changeOwner(accounts[1]);
    }).then(function(txHash) {
      return token.owner.call();
    }).then(function(newOwner) {
      assert.equal(newOwner, accounts[1], 'owner change failed.');
      return token.changeOwner(accounts[0]);
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1, 'unwanted change succeeded.');
      assert.equal(events[0].event, 'Error', 'unwanted change succeeded.');
      assert.equal(events[0].args.code.toNumber(), 2, 'unwanted change succeeded.');
    }).then(done).catch(done);
  });

  it('should prevent to set 0x00 owner address.', function(done) {
    var owner = accounts[0];
    var watcher, token;
    Token.new(owner, 2).then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.changeOwner(bytes32(0));
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1, 'unwanted change succeeded.');
      assert.equal(events[0].event, 'Error', 'unwanted change succeeded.');
      assert.equal(events[0].args.code.toNumber(), 5, 'unwanted change succeeded.');
    }).then(done).catch(done);
  });

  it('should allow to issue, then read baseUnit, and balance of know and unknown account.', function(done) {
    var token;
    var amount = 40000;
    Token.new(accounts[0], 2, accounts[1]).then(function(contract) {
      token = contract;
      return token.issue(amount);
    }).then(function(txHash){
      return token.balanceOf.call(accounts[0]);
    }).then(function(bal){
      assert.equal(bal, amount, 'issuance failed.');
      return token.balanceOf.call(accounts[1]);
    }).then(function(bal){
      assert.equal(bal, 0, 'balance failed.');
      return token.baseUnit.call();
    }).then(function(base){
      assert.equal(base, 2, 'base unit wrong.');
    }).then(done).catch(done);
  });

  it('should prevent to issue 0.', function(done) {
    var owner = accounts[0];
    var watcher, token;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(0);
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1, 'unwanted transfer succeeded.');
      assert.equal(events[0].event, 'Error', 'unwanted transfer succeeded.');
      assert.equal(events[0].args.code.toNumber(), 5, 'unwanted transfer succeeded.');
      return token.balanceOf.call(owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), 0);
    }).then(done).catch(done);
  });

  it('should prevent to issue total supply overflow.', function(done) {
    var owner = accounts[0];
    var amount = 0;
    var watcher, token;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(UINT_256_MINUS_1);
    }).then(function(txHash) {
      return token.issue(10);
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1, 'unwanted transfer succeeded.');
      assert.equal(events[0].event, 'Error', 'unwanted transfer succeeded.');
      assert.equal(events[0].args.code.toNumber(), 4, 'unwanted transfer succeeded.');
      return token.balanceOf.call(owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), UINT_256_MINUS_1);
    }).then(done).catch(done);
  });

  it('should not be possible to revoke 1 with balance 0', function(done) {
    var owner = accounts[0];
    var value = 0;
    var amount = 1;
    var isReissuable = true;
    var watcher, token;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(value);
    }).then(function(txHash) {
      return token.revoke(amount);
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1);
      assert.equal(events[0].event, 'Error', 'unwanted revoke succeeded.');
      assert.equal(events[0].args.code.toNumber(), 3, 'unwanted revoke succeeded.');
      return token.balanceOf.call(owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), value);
      return token.totalSupply.call();
    }).then(function(result) {
      assert.equal(result.valueOf(), value);
    }).then(done).catch(done);
  });

  it('should not be possible to revoke 2 with balance 1', function(done) {
    var owner = accounts[0];
    var value = 1;
    var amount = 2;
    var watcher, token;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(value);
    }).then(function(txHash) {
      return token.revoke(amount);
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1);
      assert.equal(events[0].event, 'Error', 'unwanted revoke succeeded.');
      assert.equal(events[0].args.code.toNumber(), 3, 'unwanted revoke succeeded.');
      return token.balanceOf.call(owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), value);
      return token.totalSupply.call();
    }).then(function(result) {
      assert.equal(result.valueOf(), value);
    }).then(done).catch(done);
  });

  it('should not be possible to revoke by non-owner', function(done) {
    var owner = accounts[0];
    var nonOwner = accounts[1];
    var balance = 100;
    var watcher, token;
    Token.new(owner, 2, accounts[2]).then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(VALUE);
    }).then(function(txHash) {
      return token.transfer(nonOwner, balance);
    }).then(function() {
      return token.revoke(10, {from: nonOwner});
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1);
      assert.equal(events[0].event, 'Error', 'unwanted revoke succeeded.');
      assert.equal(events[0].args.code.toNumber(), 2, 'unwanted revoke succeeded.');
      return token.balanceOf.call(owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), VALUE - balance);
      return token.balanceOf.call(nonOwner);
    }).then(function(result) {
      assert.equal(result.valueOf(), balance);
      return token.totalSupply.call();
    }).then(function(result) {
      assert.equal(result.valueOf(), VALUE);
    }).then(done).catch(done);
  });

  it('should allow to revoke 1 with 1 balance', function(done) {
    var owner = accounts[0];
    var value = 1;
    var amount = 1;
    var isReissuable = false;
    var watcher, token;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Revoke();
      return token.issue(value);
    }).then(function(txHash) {
      return token.revoke(amount);
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1);
      assert.equal(events[0].args.value.valueOf(), amount);
      return token.balanceOf.call(owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), 0);
      return token.totalSupply.call();
    }).then(function(result) {
      assert.equal(result.valueOf(), 0);
    }).then(done).catch(done);
  });

  it('should allow to revoke 1 with 2 balance', function(done) {
    var owner = accounts[0];
    var value = 2;
    var amount = 1;
    var token;
    Token.new().then(function(contract) {
      token = contract;
      return token.issue(value);
    }).then(function(txHash) {
      return token.revoke(amount);
    }).then(function() {
      return token.balanceOf.call(owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), value - amount);
      return token.totalSupply.call();
    }).then(function(result) {
      assert.equal(result.valueOf(), value - amount);
    }).then(done).catch(done);
  });

  it('should allow to revoke 2**255 with 2**255 balance');

  it('should allow to revoke (2**256 - 1) with (2**256 - 1) balance');

  it('should allow to transfer amount, then read balance.');

  it('should not be possible to transfer amount 0', function(done) {
    var owner = accounts[0];
    var nonOwner = accounts[1];
    var amount = 0;
    var watcher, token;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(VALUE);
    }).then(function(txHash) {
      return token.transfer(nonOwner, amount);
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1, 'unwanted transfer succeeded.');
      assert.equal(events[0].event, 'Error', 'unwanted transfer succeeded.');
      assert.equal(events[0].args.code.toNumber(), 3, 'unwanted transfer succeeded.');
      return token.balanceOf.call(nonOwner);
    }).then(function(result) {
      assert.equal(result.valueOf(), 0);
      return token.balanceOf.call(owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), VALUE);
    }).then(done).catch(done);
  });

  it('should not be possible to transfer amount 2 with balance 1', function(done) {
    var owner = accounts[0];
    var nonOwner = accounts[1];
    var value = 1;
    var amount = 2;
    var token;
    Token.new().then(function(contract) {
      token = contract;
      return token.issue(value);
    }).then(function(txHash) {
      return token.transfer(nonOwner, amount);
    }).then(function() {
      return token.balanceOf.call(nonOwner);
    }).then(function(result) {
      assert.equal(result.valueOf(), 0);
      return token.balanceOf.call(owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), value);
    }).then(done).catch(done);
  });

  it('should not be possible to transfer to oneself', function(done) {
    var owner = accounts[0];
    var amount = 100;
    var watcher, token;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(VALUE);
    }).then(function(txHash) {
      return token.transfer(owner, amount);
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1, 'unwanted transfer succeeded.');
      assert.equal(events[0].event, 'Error', 'unwanted transfer succeeded.');
      assert.equal(events[0].args.code.toNumber(), 5, 'unwanted transfer succeeded.');
      return token.balanceOf.call(owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), VALUE);
      return token.balanceOf.call(owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), VALUE);
    }).then(done).catch(done);
  });

  it('should be possible to transfer amount 1 to existing holder with 0 balance');

  it('should be possible to transfer amount 1 to missing holder');

  it('should be possible to transfer amount 1 to holder with non-zero balance');

  it('should not be possible to set allowance for oneself', function(done) {
    var owner = accounts[0];
    var watcher, token;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(VALUE);
    }).then(function(txHash) {
      return token.approve(owner, 100);
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1, 'unwanted transfer succeeded.');
      assert.equal(events[0].event, 'Error', 'unwanted transfer succeeded.');
      assert.equal(events[0].args.code.toNumber(), 5, 'unwanted transfer succeeded.');
      return token.allowance.call(owner, owner);
    }).then(function(result) {
      assert.equal(result.valueOf(), 0);
    }).then(done).catch(done);
  });

  it('should be possible to set allowance from missing holder to missing holder');

  it('should be possible to set allowance from missing holder to existing holder');

  it('should be possible to set allowance from existing holder to missing holder');

  it('should be possible to set allowance from existing holder to existing holder');

  it('should be possible to override allowance value with 0 value');

  it('should be possible to set allowance with (2**256 - 1) value');

  it('should be possible to set allowance value less then balance');

  it('should be possible to set allowance value equal to balance');

  it('should be possible to override allowance value with non 0 value');

  it('should not affect balance when setting allowance');

  it('should not be possible to do allowance transfer by not allowed existing spender, from existing holder');

  it('should not be possible to do allowance transfer by not allowed existing spender, from missing holder');

  it('should not be possible to do allowance transfer by not allowed missing spender, from existing holder');

  it('should not be possible to do allowance transfer by not allowed missing spender, from missing holder', function(done) {
    var token;
    var holder = accounts[2];
    var spender = accounts[1];
    var expectedSpenderBalance = 0;
    var expectedHolderBalance = 0;
    Token.new().then(function(contract) {
      token = contract;
      return token.issue(VALUE);
    }).then(function() {
      return token.transferFrom(holder, spender, 50, {from: spender});
    }).then(function() {
      return token.balanceOf.call(spender);
    }).then(function(result) {
      assert.equal(result.toNumber(), expectedSpenderBalance);
      return token.balanceOf.call(holder);
    }).then(function(result) {
      assert.equal(result.toNumber(), expectedHolderBalance);
    }).then(done).catch(done);
  });

  it('should not be possible to do allowance transfer from and to the same holder', function(done) {
    var holder = accounts[0];
    var spender = accounts[1];
    var watcher, token;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(VALUE);
    }).then(function() {
      return token.approve(spender, 50);
    }).then(function() {
      return token.transferFrom(holder, holder, 50, {from: spender});
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1, 'unwanted transfer succeeded.');
      assert.equal(events[0].event, 'Error', 'unwanted transfer succeeded.');
      assert.equal(events[0].args.code.toNumber(), 5, 'unwanted transfer succeeded.');
      return token.balanceOf.call(holder);
    }).then(function(result) {
      assert.equal(result.valueOf(), VALUE);
    }).then(done).catch(done);
  });

  it('should not be possible to do allowance transfer from oneself', function(done) {
    var holder = accounts[0];
    var receiver = accounts[1];
    var watcher, token;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(VALUE);
    }).then(function() {
      return token.approve(holder, 50);
    }).then(function() {
      return token.transferFrom(holder, receiver, 50);
    }).then(function() {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1, 'unwanted transfer succeeded.');
      assert.equal(events[0].event, 'Error', 'unwanted transfer succeeded.');
      assert.equal(events[0].args.code.toNumber(), 5, 'unwanted transfer succeeded.');
      return token.balanceOf.call(holder);
    }).then(function(result) {
      assert.equal(result.valueOf(), VALUE);
      return token.balanceOf.call(receiver);
    }).then(function(result) {
      assert.equal(result.valueOf(), 0);
    }).then(done).catch(done);
  });

  it('should not be possible to do allowance transfer with 0 value', function(done) {
    var holder = accounts[0];
    var spender = accounts[1];
    var value = 0;
    var resultValue = 0;
    var watcher, token;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(VALUE);
    }).then(function() {
      return token.approve(spender, 100);
    }).then(function() {
      return token.transferFrom(holder, spender, value, {from: spender});
    }).then(function(txHash) {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1, 'unwanted transfer succeeded.');
      assert.equal(events[0].event, 'Error', 'unwanted transfer succeeded.');
      assert.equal(events[0].args.code.toNumber(), 3, 'unwanted transfer succeeded.');
      return token.balanceOf.call(holder);
    }).then(function(result) {
      assert.equal(result.valueOf(), VALUE);
      return token.balanceOf.call(spender);
    }).then(function(result) {
      assert.equal(result.valueOf(), resultValue);
    }).then(done).catch(done);
  });

  it('should not be possible to do allowance transfer with value less than balance, more than allowed', function(done) {
    var token;
    var holder = accounts[0];
    var spender = accounts[1];
    var balance = 1000;
    var value = 999;
    var allowed = 998;
    var resultValue = 0;
    Token.new().then(function(contract) {
      token = contract;
      return token.issue(balance);
    }).then(function() {
      return token.approve(spender, allowed);
    }).then(function() {
      return token.transferFrom(holder, spender, value, {from: spender});
    }).then(function() {
      return token.balanceOf.call(holder);
    }).then(function(result) {
      assert.equal(result.valueOf(), balance);
      return token.balanceOf.call(spender);
    }).then(function(result) {
      assert.equal(result.valueOf(), resultValue);
    }).then(done).catch(done);
  });

  it('should not be possible to do allowance transfer with value equal to balance, more than allowed', function(done) {
    var token;
    var holder = accounts[0];
    var spender = accounts[1];
    var balance = 1000;
    var value = 1000;
    var allowed = 999;
    var resultValue = 0;
    Token.new().then(function(contract) {
      token = contract;
      return token.issue(balance);
    }).then(function() {
      return token.approve(spender, allowed);
    }).then(function() {
      return token.transferFrom(holder, spender, value, {from: spender});
    }).then(function() {
      return token.balanceOf.call(holder);
    }).then(function(result) {
      assert.equal(result.valueOf(), balance);
      return token.balanceOf.call(spender);
    }).then(function(result) {
      assert.equal(result.valueOf(), resultValue);
    }).then(done).catch(done);
  });

  it('should not be possible to do allowance transfer with 0 value', function(done) {
    var token, watcher;
    var holder = accounts[0];
    var spender = accounts[1];
    var value = 0;
    var resultValue = 0;
    Token.new().then(function(contract) {
      token = contract;
      watcher = token.Error();
      return token.issue(VALUE);
    }).then(function() {
      return token.approve(spender, 100);
    }).then(function() {
      return token.transferFrom(holder, spender, value, {from: spender});
    }).then(function() {
      return promisify(watcher);
    }).then(function(events) {
      assert.equal(events.length, 1, 'unwanted transfer succeeded.');
      assert.equal(events[0].event, 'Error', 'unwanted transfer succeeded.');
      assert.equal(events[0].args.code.toNumber(), 3, 'unwanted transfer succeeded.');
      return token.balanceOf.call(holder);
    }).then(function(result) {
      assert.equal(result.valueOf(), VALUE);
      return token.balanceOf.call(spender);
    }).then(function(result) {
      assert.equal(result.valueOf(), resultValue);
    }).then(done).catch(done);
  });

  it('should not be possible to do allowance transfer with value less than balance, more than allowed after another tranfer', function(done) {
    var holder = accounts[0];
    var spender = accounts[1];
    var balance = 102;
    var anotherValue = 10;
    var value = 91;
    var allowed = 100;
    var expectedHolderBalance = balance - anotherValue;
    var resultValue = anotherValue;
    var token;
    var amount = 40000;
    Token.new().then(function(contract) {
      token = contract;
      return token.issue(balance);
    }).then(function() {
      return token.approve(spender, allowed);
    }).then(function() {
      return token.transferFrom(holder, spender, anotherValue, {from: spender});
    }).then(function() {
      return token.transferFrom(holder, spender, value, {from: spender});
    }).then(function() {
      return token.balanceOf.call(holder);
    }).then(function(result) {
      assert.equal(result.valueOf(), expectedHolderBalance);
      return token.balanceOf.call(spender);
    }).then(function(result) {
      assert.equal(result.valueOf(), resultValue);
    }).then(done).catch(done);
  });




});