contract("AccountController", (accounts) => {

  var receiptAddr1 = '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74';

  before(() => {
    proxy = AccountProxy.deployed();
  });

  it("Correctly deploys contract", (done) => {
    var controller;
    AccountController.new(proxy.address, receiptAddr1, 0).then((contract) => {
      controller = contract;
      return controller.proxyAddr.call();
    }).then((proxyAddr) => {
      assert.equal(proxyAddr, proxy.address);
      return controller.receiptAddr.call();
    }).then((receiptAddr) => {
      assert.equal(receiptAddr, receiptAddr1);
      return controller.changeRecoveryAddr(accounts[1]);
    }).then(() => {
      return controller.recoveryAddr.call();
    }).then((recoveryAddr) => {
      assert.equal(recoveryAddr, accounts[1]);
      done();
    }).catch(done);
  });

  it("Only sends transactions from correct user", (done) => {
    // Transfer ownership of proxy to the controller contract.
    proxy.transfer(standardController.address, {from:user1}).then(() => {
      // Encode the transaction to send to the Owner contract
      var data = '0x' + lightwallet.txutils._encodeFunctionTxData('register', ['uint256'], [LOG_NUMBER_1]);
      return standardController.forward(testReg.address, 0, data, {from: user1});
    }).then(() => {
      // Verify that the proxy address is logged as the sender
      return testReg.registry.call(proxy.address);
    }).then((regData) => {
      assert.equal(regData.toNumber(), LOG_NUMBER_1, "User1 should be able to send transaction");

      // Encode the transaction to send to the Owner contract
      var data = '0x' + lightwallet.txutils._encodeFunctionTxData('register', ['uint256'], [LOG_NUMBER_2]);
      return standardController.forward(testReg.address, 0, data, {from: user2});
    }).then(() => {
      // Verify that the proxy address is logged as the sender
      return testReg.registry.call(proxy.address);
    }).then((regData) => {
      assert.notEqual(regData.toNumber(), LOG_NUMBER_2, "User2 should not be able to send transaction");
      done();
    }).catch(done);
  });

  it("Updates userKey as recovery", (done) => { //userkey is currently user2
    standardController.changeUserKeyFromRecovery(user3, {from: user2}).then(() => {
      return standardController.userKey();
    }).then((userKey) => {
      assert.equal(userKey, user2, "Only user can call changeUserKeyFromRecovery");
      return standardController.changeUserKeyFromRecovery(user3, {from: admin1})
    }).then(() => {
      return standardController.userKey()
    }).then((userKey) => {
      assert.equal(user3, user3, "New user should immediately take affect");
      done();
    }).catch(done);
  });

  it("Updates recoveryKey as recovery", (done) => { //recoveryKey is currently admin2
    standardController.changeRecoveryFromRecovery(admin3, {from: user3}).then(() => {
      return standardController.recoveryKey();
    }).then((recoveryKey) => {
      assert.equal(recoveryKey, admin2, "Only recovery key can call changeRecoveryFromRecovery");
      return standardController.changeRecoveryFromRecovery(admin3, {from: admin2})
    }).then(() => {
      return standardController.recoveryKey()
    }).then((recoveryKey) => {
      assert.equal(recoveryKey, admin3, "New recoveryKey should immediately take affect");
      done();
    }).catch(done);
  });

  it("Correctly performs transfer", (done) => { //userKey is currently user3
    standardController.signControllerChange(user1, {from: admin1}).then(() => {
      return standardController.proposedController();
    }).then((proposedController) => {
      assert.equal(proposedController, 0x0, "Only user can set the proposedController");
      return standardController.signControllerChange(user1, {from: user3})
    }).then(() => {
      return standardController.proposedController()
    }).then((proposedController) => {
      assert.equal(proposedController, user1, "New controller should now be cued up");
      return proxy.owner();
    }).then((proxyOwner) => {
      assert.equal(proxyOwner, standardController.address, "proxy should not change until changeController is called");
      return standardController.changeController({from: nobody})
    }).then(() => {
      return wait(longTime + 1)
    }).then(() => {
      return proxy.owner()
    }).then((proxyOwner) => {
      assert.equal(proxyOwner, standardController.address, "Should still not have changed controller unless changeController is called after longTimeLock period");
      return standardController.changeController({from: nobody})
    }).then(() => {
      return proxy.owner()
    }).then((proxyOwner) => {
      assert.equal(proxyOwner, user1, "ChangeController Should affect proxy ownership after longTimeLock period");
      done();
    }).catch(done);
  });
});