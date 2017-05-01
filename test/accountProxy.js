const SafeTokenMock = artifacts.require("../contracts/SafeTokenMock.sol");
const AccountProxy = artifacts.require('../contracts/AccountProxy.sol');
require('./helpers/transactionMined.js');
const assertJump = require('./helpers/assertJump');

contract("AccountProxy", (accounts) => {
  const amount = web3.toWei(1, 'ether');

  it("Owner can send transaction", async () => {
    // Encode the transaction to send to the proxy contract
    // transfer(accounts[1], 1000)
    var data = `0xa9059cbb000000000000000000000000${accounts[1].replace('0x', '')}00000000000000000000000000000000000000000000000000000000000003e8`;
    // Send forward request from the owner
    const proxy = await AccountProxy.new();
    const token = await SafeTokenMock.new(proxy.address, 3000);
    await proxy.forward(token.address, data, { from: accounts[0] });
    const bal = await token.balanceOf.call(proxy.address);
    assert.equal(bal.toNumber(), 2000);
  });

  it("Basic forwarding test", async () => {
    // create proxy contract from my account
    const proxy = await AccountProxy.new();
    const token = await SafeTokenMock.new(proxy.address, 0);
    // set token address
    await proxy.forwardEth(token.address, 0);
    // send 1 ether to proxy
    const txHash = web3.eth.sendTransaction({ from: accounts[2], to: proxy.address, value: amount });
    await web3.eth.transactionMined(txHash);
    // check 1 ether was sold to token contract
    const bal = await token.balanceOf.call(proxy.address);
    assert.equal(bal.toNumber(), amount/1000, 'forward failed.');
  });

  it("Receives transaction", (done) => {
    let proxy;
    AccountProxy.new().then((contract) => {
      proxy = contract;
      const event = proxy.Received();
      // Encode the transaction to send to the proxy contract
      event.watch((error, result) => {
        event.stopWatching()
        //console.log(result)
        assert.equal(result.args.sender, accounts[1]);
        assert.equal(result.args.value, web3.toWei('1', 'ether'));
        done();
      });
      web3.eth.sendTransaction({ from: accounts[1], to: proxy.address, value: amount });
    });
  });

  it("Non-owner can't send transaction", async () => {
    // Encode the transaction to send to the proxy contract
    // transfer(accounts[1], 1000)
    var data = `0xa9059cbb000000000000000000000000${accounts[1].replace('0x', '')}00000000000000000000000000000000000000000000000000000000000003e8`;
    // Send forward request from a non-owner
    const proxy = await AccountProxy.new();
    const token = await SafeTokenMock.new(proxy.address, 3000);
    await proxy.forward(token.address, '0x' + data, { from: accounts[1] });
    const bal = await token.balanceOf.call(proxy.address);
    assert.equal(bal.toNumber(), 3000);
  });

  it("Should throw if function call fails", async () => {
    const proxy = await AccountProxy.new();
    const token = await SafeTokenMock.new(accounts[0], 0);
    try {
      await proxy.forward(token.address, '0x50bff6bf', { from: accounts[0] });
    } catch (err) {
      assertJump(err);
    }
  });
});