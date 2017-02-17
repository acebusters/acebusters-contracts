contract("AccountProxy", (accounts) => {
  var proxy
  var testToken

  before(() => {
    proxy = AccountProxy.deployed();
    testToken = Token.deployed();
  });

  it("Owner can send transaction", (done) => {
    // Encode the transaction to send to the proxy contract
    // issue(1000)
    var data = 'cc872b6600000000000000000000000000000000000000000000000000000000000003e8';
    // Send forward request from the owner
    proxy.forward(testToken.address, '0x' + data, {from: accounts[0]}).then(() => {
      return testToken.balanceOf.call(proxy.address);
    }).then((rsp) => {
      assert.equal(rsp.toNumber(), 1000)
      done();
    }).catch(done);
  });

  it("Receives transaction", (done) => {
    var event = proxy.Received();
    // Encode the transaction to send to the proxy contract
    event.watch((error, result) => {
      event.stopWatching()
      //console.log(result)
      assert.equal(result.args.sender, accounts[1]);
      assert.equal(result.args.value, web3.toWei('1', 'ether'));
      done();
    });
    web3.eth.sendTransaction({from: accounts[1], to: proxy.address, value: web3.toWei('1', 'ether')});
  });

  it("Non-owner can't send transaction", (done) => {
    // Encode the transaction to send to the proxy contract
    // issue(2000)
    var data = 'cc872b6600000000000000000000000000000000000000000000000000000000000007d0';
    // Send forward request from a non-owner
    proxy.forward(testToken.address, '0x' + data, {from: accounts[1]}).then(() => {
      return testToken.balanceOf.call(proxy.address);
    }).then((rsp) => {
      assert.notEqual(rsp.toNumber(), 3000)
      done();
    }).catch(done);
  });

  it("Should throw if function call fails", (done) => {
    var errorThrown = false;
    // Encode the transaction to send to the proxy contract
    var data = '50bff6bf';
    proxy.forward(testToken.address, '0x' + data, {from: accounts[0]}).catch((e) => {
      errorThrown = true;
    }).then(() => {
      assert.isTrue(errorThrown, "An error should have been thrown");
      done();
    }).catch(done);
  });
});