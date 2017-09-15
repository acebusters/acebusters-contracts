import { Receipt } from 'poker-helper';
const NutzMock = artifacts.require("../contracts/ERC223BasicToken.sol");
const FishProxy = artifacts.require('../contracts/FishProxy.sol');
require('./helpers/transactionMined.js');
const assertJump = require('./helpers/assertJump');

contract("FishProxy", (accounts) => {
  const amount = web3.toWei(0.09, 'ether');

  it("Owner can send transaction", async () => {
    // Encode the transaction to send to the proxy contract
    // transfer(accounts[1], 1000)
    var data = `0xa9059cbb000000000000000000000000${accounts[1].replace('0x', '')}00000000000000000000000000000000000000000000000000000000000003e8`;
    // Send forward request from the owner
    const proxy = await FishProxy.new(accounts[0], accounts[1]);
    const token = await NutzMock.new();
    await token.transfer(proxy.address, 100000);
    await proxy.forward(token.address, 0, data, { from: accounts[0] });
    const bal = await token.balanceOf.call(proxy.address);
    assert.equal(bal.toNumber(), 99000);
  });

  it("Basic forwarding test", async () => {
    // create proxy contract from my account
    const proxy = await FishProxy.new(accounts[0], accounts[1]);
    const token = await NutzMock.new();
    await token.transfer(proxy.address, 100000);
    // send 0.01 ether to proxy
    const txHash = web3.eth.sendTransaction({ from: accounts[2], to: proxy.address, value: 10000000000000000 });
    await web3.eth.transactionMined(txHash);
    // forward 1 ether to token address
    await proxy.forward(token.address, 5000000000000000, 0);
    // check 1 ether was sold to token contract
    const bal = await token.balanceOf.call(proxy.address);
    // should hold tokens purchased at ceiling price, here 3000
    assert.equal(bal.toNumber(), 1666666766666, 'forward failed.');
  });

  it("should allow to unlock", async () => {
    const METAMASK_ADDR = accounts[1];
    const LOCK_ADDR = '0x82e8c6cf42c8d1ff9594b17a3f50e94a12cc860f';
    const LOCK_PRIV = '0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4';
    // create proxy contract
    const proxy = await FishProxy.new(accounts[0], LOCK_ADDR);
    // check locked
    let isLocked = await proxy.isLocked.call();
    assert(isLocked);
    // unlock
    const unlock = new Receipt(proxy.address).unlock(METAMASK_ADDR).sign(LOCK_PRIV);
    await proxy.unlock(...Receipt.parseToParams(unlock), {from: METAMASK_ADDR});
    // check unlocked
    isLocked = await proxy.isLocked.call();
    assert(!isLocked);
  });

  it("Receives transaction when deposit amount less than 0.1 ether", (done) => {
    let proxy;
    FishProxy.new(accounts[0], accounts[1]).then((contract) => {
      proxy = contract;
      const event = proxy.Deposit();
      // Encode the transaction to send to the proxy contract
      event.watch((error, result) => {
        event.stopWatching()
        assert.equal(result.args.sender, accounts[1]);
        assert.equal(result.args.value.toNumber(), 9e16);
        done();
      });
      web3.eth.sendTransaction({ from: accounts[1], to: proxy.address, value: 9e16 });
    });
  });

  it("Receives transaction when deposit amount is equal to 0.1 ether", (done) => {
    let proxy;
    FishProxy.new(accounts[0], accounts[1]).then((contract) => {
      proxy = contract;
      const event = proxy.Deposit();
      // Encode the transaction to send to the proxy contract
      event.watch((error, result) => {
        event.stopWatching()
        assert.equal(result.args.sender, accounts[1]);
        assert.equal(result.args.value.toNumber(), 1e17);
        done();
      });
      web3.eth.sendTransaction({ from: accounts[1], to: proxy.address, value: 1e17 });
    });
  });

  it("Transaction fails when deposit amount greater than 0.1 ether", async () => {
    const proxy = await FishProxy.new(accounts[0], accounts[1]);
    const proxyBalanceBefore = web3.eth.getBalance(proxy.address).toNumber();
    try {
      await web3.eth.sendTransaction({ from: accounts[1], to: proxy.address, value: 1e17 + 10 });
      assert.fail('should have thrown before');
    } catch (err) {
      assertJump(err);
      const proxyBalanceAfter = web3.eth.getBalance(proxy.address).toNumber();
      assert.equal(proxyBalanceBefore, proxyBalanceAfter, 'proxy balance changed')
    }
  });

  it("Transaction fails when deposit made after limit reached", async () => {
    const proxy = await FishProxy.new(accounts[0], accounts[1]);
    await web3.eth.sendTransaction({ from: accounts[1], to: proxy.address, value: 1e17});
    const proxyBalanceBefore = web3.eth.getBalance(proxy.address).toNumber();
    try {
      await web3.eth.sendTransaction({ from: accounts[1], to: proxy.address, value: 10 });
      assert.fail('should have thrown before');
    } catch (err) {
      assertJump(err);
      const proxyBalanceAfter = web3.eth.getBalance(proxy.address).toNumber();
      assert.equal(proxyBalanceBefore, proxyBalanceAfter, 'proxy balance changed')
    }
  });

  it("Receives transaction", (done) => {
    let proxy;
    FishProxy.new(accounts[0], accounts[1]).then((contract) => {
      proxy = contract;
      const event = proxy.Deposit();
      // Encode the transaction to send to the proxy contract
      event.watch((error, result) => {
        event.stopWatching()
        assert.equal(result.args.sender, accounts[1]);
        assert.equal(result.args.value.toNumber(), 10000000000000000);
        done();
      });
      web3.eth.sendTransaction({ from: accounts[1], to: proxy.address, value: 10000000000000000 });
    });
  });


  it("Non-owner can't send transaction", async () => {
    // Encode the transaction to send to the proxy contract
    // transfer(accounts[1], 1000)
    var data = `0xa9059cbb000000000000000000000000${accounts[1].replace('0x', '')}00000000000000000000000000000000000000000000000000000000000003e8`;
    // Send forward request from a non-owner
    const proxy = await FishProxy.new(accounts[0], accounts[1]);
    const token = await NutzMock.new();
    await token.transfer(proxy.address, 3000);
    try {
      await proxy.forward(token.address, 0, data, { from: accounts[1] });
      assert.fail('should have thrown before');
    } catch (err) {
      assertJump(err);
    }
  });

  it("Should throw if function call fails", async () => {
    const proxy = await FishProxy.new(accounts[0], accounts[1]);
    const token = await NutzMock.new(accounts[0], 0);
    try {
      // transfer(accounts[1], 1000)
      var data = `0xa9059cbb000000000000000000000000${accounts[1].replace('0x', '')}00000000000000000000000000000000000000000000000000000000000003e8`;
      await proxy.forward(token.address, 0, data, { from: accounts[0] });
      assert.fail('should have thrown before');
    } catch (err) {
      assertJump(err);
    }
  });
});
