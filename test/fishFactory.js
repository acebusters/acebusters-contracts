import { Receipt } from 'poker-helper';
import ethUtil from 'ethereumjs-util';
var FishProxy = artifacts.require('../contracts/FishProxy.sol');
var FishFactory = artifacts.require('../contracts/FishFactory.sol');

contract("FishFactory", (accounts) => {

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
    FishProxy.new().then((contract) => {
      proxy = contract;
      return FishFactory.new();
    }).then((contract) => {
      factory = contract;
      var event = factory.AccountCreated();
      event.watch((error, result) => {
        event.stopWatching();
        assert.equal(proxyAddr, result.args.proxy, "Proxy address could not be predicted");
        assert.equal(web3.eth.getCode(result.args.proxy),
         web3.eth.getCode(proxy.address),
         "Created proxy should have correct code");
        done();
      });
      //web3.eth.getTransactionCount
      return web3.eth.getTransactionCount(factory.address)
    }).then(function(txCount) {
      proxyAddr = ethUtil.bufferToHex(ethUtil.generateAddress(factory.address, txCount));
      factory.create(signer, LOCK_ADDR);
    });
  });

});
