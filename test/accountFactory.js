var AccountProxy = artifacts.require('../contracts/AccountProxy.sol');
var AccountController = artifacts.require('../contracts/AccountController.sol');
var AccountFactory = artifacts.require('../contracts/AccountFactory.sol');

contract("AccountFactory", (accounts) => {
  let factory;
  let controller;
  let proxy;
  const signer = accounts[1];
  const recovery = accounts[2];
  const RECOVERY_ADDR = '0x82e8c6cf42c8d1ff9594b17a3f50e94a12cc860f';
  const RECOVERY_PRIV = '0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4';
  const P_EMPTY = '0x0000000000000000000000000000000000000000';

  it("Correctly creates proxy, and controller", (done) => {
    var newController;
    var newProxy;
    AccountProxy.new().then((contract) => {
      proxy = contract;
      return AccountController.new();
    }).then((contract) => {
      controller = contract;
      return AccountFactory.new();
    }).then((contract) => {
      factory = contract;
      var event = factory.AccountCreated();
      event.watch((error, result) => {
        event.stopWatching();

        assert.equal(web3.eth.getCode(result.args.proxy),
                     web3.eth.getCode(proxy.address),
                     "Created proxy should have correct code");
        assert.equal(web3.eth.getCode(result.args.controller),
                     web3.eth.getCode(controller.address),
                     "Created controller should have correct code");
        assert.equal(result.args.recovery, recovery,
                     "Create event should have correct recovery address");
        // Check that the mapping has correct proxy address
        factory.signerToProxy.call(signer).then((proxyAddr) => {
          assert.equal(proxyAddr, result.args.proxy, 
            "Mapping should have the same address as event");
          newProxy = AccountProxy.at(proxyAddr);
          return newProxy.owner.call();
        }).then((controllerAddr) => {
          assert.equal(controllerAddr, result.args.controller,
            "Created Contoller should be owner of proxy");
          newController = AccountController.at(controllerAddr);
          return newController.proxy.call();
        }).then((proxyAddr) => {
          assert.equal(proxyAddr, result.args.proxy,
            "Created Proxy should be configured in controller");
          return newController.signer.call();
        }).then((signerAddr) => {
          assert.equal(signerAddr, signer,
            "Signer should be configured in controller.");
          return newController.recovery.call();
        }).then((recoveryAddr) => {
          assert.equal(recoveryAddr, recovery,
            "Recovery should be configured in controller.");
          done();
        }).catch(done);
      });
      factory.create(signer, recovery, 0);
    });
  });

 it("correctly recovers account", (done) => {
    let factory;
    let controllerAddr;
    const newSigner = accounts[3];
    AccountFactory.new().then((contract) => {
      factory = contract;
      return factory.create(signer, RECOVERY_ADDR, 0);
    }).then((txHash) => {
      return factory.getAccount.call(signer);
    }).then((entry) => {
      controllerAddr = entry[1];
      const controller = AccountController.at(controllerAddr);

      const recoveryReceipt = new Receipt(controllerAddr).recover(1, newSigner).sign(RECOVERY_PRIV);
      return controller.changeSigner(...Receipt.parseToParams(recoveryReceipt));
    }).then((txHash) => {
      return factory.getAccount.call(newSigner);
    }).then((entry) => {
      assert.equal(entry[1], controllerAddr, "Recovery not set in factory.");
      done();
    }).catch(done);
  });
});
