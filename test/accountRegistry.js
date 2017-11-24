import { Receipt } from 'poker-helper';
import ethUtil from 'ethereumjs-util';
var AccountProxy = artifacts.require('../contracts/AccountProxy.sol');
var AccountRegistry = artifacts.require('../contracts/AccountRegistry.sol');

contract("AccountRegistry", (accounts) => {

  const signer = accounts[1];
  const tokenAddr = accounts[4];
  const LOCK_ADDR = '0x82e8c6cf42c8d1ff9594b17a3f50e94a12cc860f';
  const LOCK_PRIV = '0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4';
  const P_EMPTY = '0x0000000000000000000000000000000000000000';

  it("Correctly registers proxy, and controller", (done) => {
    let registry;
    let proxy;
    let newProxy;
    let proxyAddr;
    AccountProxy.new().then((contract) => {
      proxy = contract;
      return AccountRegistry.new();
    }).then((contract) => {
      registry = contract;
      var event = registry.AccountRegistered();
      event.watch((error, result) => {
        event.stopWatching();
        assert.equal(web3.eth.getCode(result.args.proxy),
                     web3.eth.getCode(proxy.address),
                     "Created proxy should have correct code");
        assert.equal(result.args.signer, signer,
                     "Create event should have correct signer address");
        // Check that the mapping has correct proxy address
        registry.getAccount.call(signer).then((entry) => {
          assert.equal(entry[0], result.args.proxy,
            "Mapping should have the same address as event");
          newProxy = AccountProxy.at(entry[0]);
          assert.equal(entry[1], accounts[0],
            "Tx sender should be owner of proxy");
          done();
        }).catch(done);
      });
    }).then(function() {
      AccountProxy.new(accounts[0], LOCK_ADDR, {from:accounts[0]}).then((contract) => {
        proxy = contract;
        const data = '0x4420e486000000000000000000000000'+signer.replace('0x', '');
        proxy.forward(registry.address, 0, data, {from:accounts[0]});
      })
    });
  });

  it("correctly recovers account", async () => {
    const newSigner = accounts[3];
    const registry = await AccountRegistry.new();
    const data = '0x4420e486000000000000000000000000'+signer.replace('0x', '');
    const proxy = await AccountProxy.new(accounts[0], LOCK_ADDR, {from:accounts[0]});
    await proxy.forward(registry.address, 0, data, {from:accounts[0]});
    const entry1 = await registry.getAccount.call(signer);
    // bytes4(sha3("handleRecovery(address)"))
    await proxy.forward(registry.address, 0, '0x5486413f000000000000000000000000'+newSigner.replace('0x', ''));
    const entry2 = await registry.getAccount.call(newSigner);
    assert.equal(entry2[1], entry1[1], "Recovery not set in registry.");
  });
});
