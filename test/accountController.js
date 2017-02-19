contract("AccountController", (accounts) => {

  var signerAddr1 = '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74';
  var token;

  before(() => {
    proxy = AccountProxy.deployed();
    token = Token.deployed();
  });

  var wait = (seconds) => new Promise((resolve) => setTimeout(() => resolve(), seconds * 1000));

  it("Correctly deploys contract", (done) => {
    var controller;
    AccountController.new(proxy.address, accounts[0], accounts[0], 0).then((contract) => {
      controller = contract;
      return controller.proxy.call();
    }).then((proxyAddr) => {
      assert.equal(proxyAddr, proxy.address);
      return controller.signer.call();
    }).then((signerAddr) => {
      assert.equal(signerAddr, accounts[0]);
      return controller.recovery.call();
    }).then((recoveryAddr) => {
      assert.equal(recoveryAddr, accounts[0]);
      done();
    }).catch(done);
  });

  it("Only sends transactions from correct user", (done) => {
    // Transfer ownership of proxy to the controller contract.
    var data = 'cc872b6600000000000000000000000000000000000000000000000000000000000007d0';
    var controller;
    AccountController.new(proxy.address, accounts[0], accounts[0], 0).then((contract) => {
      controller = contract;
      return proxy.transfer(controller.address);
    }).then(() => {
      // issue 2000 in token through proxy
      return controller.forwardTx(token.address, '0x' + data);
    }).then(() => {
      // Verify that the proxy address is logged as the sender
      return token.balanceOf.call(proxy.address);
    }).then((bal) => {
      assert.equal(bal.toNumber(), 2000, "should be able to proxy transaction");

      // issue 2000 in token through proxy if not authorized
      return controller.forwardTx(token.address, '0x' + data, {from: accounts[1]});
    }).then(() => {
      // Verify that transaction did not take effect
      return token.balanceOf.call(proxy.address);
    }).then((bal) => {
      assert.equal(bal.toNumber(), 2000, "unknow sender should not be able to proxy transaction");
      done();
    }).catch(done);
  });

  it("Updates signerAddr as recovery", (done) => {
    var controller;
    var signer = accounts[1];
    AccountController.new(proxy.address, signer, accounts[0], 0).then((contract) => {
      controller = contract;
      // try to change signer address from signer address
      return controller.changeSigner(accounts[2], {from: signer});
    }).then(() => {
      return controller.signer.call();
    }).then((signerAddr) => {
      assert.equal(signerAddr, signer, "Only recovery can call changeSignerAddr.");
      return controller.changeSigner(accounts[2]);
    }).then(() => {
      return controller.signer.call();
    }).then((signerAddr) => {
      assert.equal(signerAddr, accounts[2], "Recovery should be able to change signer.");
      done();
    }).catch(done);
  });

  it("Updates recoveryAddr as recovery", (done) => {
    var controller;
    var signer = accounts[1];
    AccountController.new(proxy.address, signer, accounts[0], 0).then((contract) => {
      controller = contract;
      return controller.signRecoveryChangeTx(accounts[2], {from: accounts[3]});
    }).then(() => {
      return controller.newRecovery.call();
    }).then((recoveryAddr) => {
      assert.equal(recoveryAddr, 0x0, "Only recovery or signer can call changeRecoveryFromRecovery");

      return controller.signRecoveryChangeTx(accounts[2]);
    }).then(() => {
      return controller.newRecovery.call();
    }).then((recoveryAddr) => {
      assert.equal(recoveryAddr, accounts[2], "Recovery should be able to change recovery.");
      return wait(1);
    }).then(() => {
      return controller.changeRecovery({from: signer});
    }).then(() => {
      return controller.recovery.call();
    }).then((recoveryAddr) => {
      assert.equal(recoveryAddr, accounts[2], "ChangeRecovery Should affect recovery address after longTimeLock period");
      done();
    }).catch(done);
  });

  it("Correctly performs transfer", (done) => {
    var controller;
    var proxyContract;
    var signer = accounts[1];
    var newController = accounts[2];

    AccountProxy.new().then((contract) => {
      proxyContract = contract;
      return AccountController.new(proxyContract.address, signer, accounts[0], 0);
    }).then((contract) => {
      controller = contract;
      return proxyContract.transfer(controller.address);
    }).then(() => {
      return controller.signControllerChangeTx(newController, {from: accounts[2]});
    }).then(() => {
      return controller.newController.call();
    }).then((newControllerAddr) => {
      assert.equal(newControllerAddr, 0x0, "Only user can set the newController");

      return controller.signControllerChangeTx(newController, {from: signer});
    }).then(() => {
      return controller.newController.call();
    }).then((newControllerAddr) => {
      assert.equal(newControllerAddr, newController, "New controller should now be cued up");
      return proxyContract.owner.call();
    }).then((proxyOwner) => {
      assert.equal(proxyOwner, controller.address, "proxy should not change until changeController is called");
      return wait(1);
    }).then(() => {
      return controller.changeController({from: signer});
    }).then(() => {
      return proxyContract.owner.call();
    }).then((proxyOwner) => {
      assert.equal(proxyOwner, newController, "ChangeController Should affect proxy ownership after longTimeLock period");
      done();
    }).catch(done);
  });
});