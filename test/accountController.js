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
    AccountController.new(proxy.address, accounts[0], 0).then((contract) => {
      controller = contract;
      return controller.proxyAddr.call();
    }).then((proxyAddr) => {
      assert.equal(proxyAddr, proxy.address);
      return controller.signerAddr.call();
    }).then((signerAddr) => {
      assert.equal(signerAddr, accounts[0]);
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
    var data = 'cc872b6600000000000000000000000000000000000000000000000000000000000007d0';
    var controller;
    AccountController.new(proxy.address, accounts[0], 0).then((contract) => {
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
    AccountController.new(proxy.address, signer, 0).then((contract) => {
      controller = contract;
      // try to change signer address from signer address
      return controller.changeSignerAddr(accounts[2], {from: signer});
    }).then(() => {
      return controller.signerAddr.call();
    }).then((signerAddr) => {
      assert.equal(signerAddr, signer, "Only recovery can call changeSignerAddr.");
      return controller.changeSignerAddr(accounts[2]);
    }).then(() => {
      return controller.signerAddr.call();
    }).then((signerAddr) => {
      assert.equal(signerAddr, accounts[2], "Recovery should be able to change signer.");
      done();
    }).catch(done);
  });

  it("Updates recoveryAddr as recovery", (done) => {
    var controller;
    var signer = accounts[1];
    AccountController.new(proxy.address, signer, 0).then((contract) => {
      controller = contract;
      return controller.changeRecoveryAddr(accounts[2], {from: signer});
    }).then(() => {
      return controller.recoveryAddr.call();
    }).then((recoveryAddr) => {
      assert.equal(recoveryAddr, accounts[0], "Only recovery key can call changeRecoveryFromRecovery");

      return controller.changeRecoveryAddr(accounts[2]);
    }).then(() => {
      return controller.recoveryAddr.call();
    }).then((recoveryAddr) => {
      assert.equal(recoveryAddr, accounts[2], "Recovery should be able to change recovery.");
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
      return AccountController.new(proxyContract.address, signer, 0);
    }).then((contract) => {
      controller = contract;
      return proxyContract.transfer(controller.address);
    }).then(() => {
      return controller.signControllerChangeTx(newController, {from: accounts[2]});
    }).then(() => {
      return controller.proposedController.call();
    }).then((proposedController) => {
      assert.equal(proposedController, 0x0, "Only user can set the proposedController");

      return controller.signControllerChangeTx(newController, {from: signer});
    }).then(() => {
      return controller.proposedController.call();
    }).then((proposedController) => {
      assert.equal(proposedController, newController, "New controller should now be cued up");
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