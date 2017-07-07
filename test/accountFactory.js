import { Receipt } from 'poker-helper';
import ethUtil from 'ethereumjs-util';
var AccountProxy = artifacts.require('../contracts/AccountProxy.sol');
var AccountFactory = artifacts.require('../contracts/AccountFactory.sol');

contract("AccountFactory", (accounts) => {

  const signer = accounts[1];
  const tokenAddr = accounts[4];
  const LOCK_ADDR = '0x82e8c6cf42c8d1ff9594b17a3f50e94a12cc860f';
  const LOCK_PRIV = '0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4';
  const P_EMPTY = '0x0000000000000000000000000000000000000000';

  it("Correctly creates proxy, and controller", (done) => {
    let factory;
    let proxy;
    let newProxy;
    let proxyAddr;
    AccountProxy.new().then((contract) => {
      proxy = contract;
      return AccountFactory.new();
    }).then((contract) => {
      factory = contract;
      var event = factory.AccountCreated();
      event.watch((error, result) => {
        event.stopWatching();
        assert.equal(proxyAddr, result.args.proxy, "Proxy address could not be predicted");
        assert.equal(web3.eth.getCode(result.args.proxy),
                     web3.eth.getCode(proxy.address),
                     "Created proxy should have correct code");
        assert.equal(result.args.signer, signer,
                     "Create event should have correct signer address");
        // Check that the mapping has correct proxy address
        factory.getAccount.call(signer).then((entry) => {
          assert.equal(entry[0], result.args.proxy, 
            "Mapping should have the same address as event");
          newProxy = AccountProxy.at(entry[0]);
          assert.equal(entry[1], accounts[0],
            "Tx sender should be owner of proxy");
          done();
        }).catch(done);
      });
      //web3.eth.getTransactionCount
      return web3.eth.getTransactionCount(factory.address)
    }).then(function(txCount) {
      proxyAddr = ethUtil.bufferToHex(ethUtil.generateAddress(factory.address, txCount));
      factory.create(signer, LOCK_ADDR);
    });
  });

  it("correctly recovers account", async () => {
    const newSigner = accounts[3];
    const factory = await AccountFactory.new();
    await factory.create(signer, LOCK_ADDR);
    const entry1 = await factory.getAccount.call(signer);
    const proxy = AccountProxy.at(entry1[0]);
    // bytes4(sha3("handleRecovery(address)"))
    await proxy.forward(factory.address, 0, '0x5486413f000000000000000000000000'+newSigner.replace('0x', ''));
    const entry2 = await factory.getAccount.call(newSigner);
    assert.equal(entry2[1], entry1[1], "Recovery not set in factory.");
  });
});
