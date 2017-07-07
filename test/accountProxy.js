const NutzMock = artifacts.require("../contracts/ERC223BasicToken.sol");
const AccountProxy = artifacts.require('../contracts/AccountProxy.sol');
require('./helpers/transactionMined.js');
const assertJump = require('./helpers/assertJump');

contract("AccountProxy", (accounts) => {
  const amount = web3.toWei(0.09, 'ether');

  it("Owner can send transaction", async () => {
    // Encode the transaction to send to the proxy contract
    // transfer(accounts[1], 1000)
    var data = `0xa9059cbb000000000000000000000000${accounts[1].replace('0x', '')}00000000000000000000000000000000000000000000000000000000000003e8`;
    // Send forward request from the owner
    const proxy = await AccountProxy.new(accounts[0], accounts[1]);
    const token = await NutzMock.new();
    await token.transfer(proxy.address, 100000);
    await proxy.forward(token.address, 0, data, { from: accounts[0] });
    const bal = await token.balanceOf.call(proxy.address);
    assert.equal(bal.toNumber(), 99000);
  });

  it("Basic forwarding test", async () => {
    // create proxy contract from my account
    const proxy = await AccountProxy.new(accounts[0], accounts[1]);
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

  it("Receives transaction", (done) => {
    let proxy;
    AccountProxy.new(accounts[0], accounts[1]).then((contract) => {
      proxy = contract;
      const event = proxy.Deposit();
      // Encode the transaction to send to the proxy contract
      event.watch((error, result) => {
        event.stopWatching()
        //console.log(result)
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
    const proxy = await AccountProxy.new();
    const token = await NutzMock.new();
    await token.transfer(proxy.address, 3000);
    await proxy.forward(token.address, 0, data, { from: accounts[1] });
    const bal = await token.balanceOf.call(proxy.address);
    assert.equal(bal.toNumber(), 3000);
  });

  it("Should throw if function call fails", async () => {
    const proxy = await AccountProxy.new();
    const token = await NutzMock.new(accounts[0], 0);
    try {
      await proxy.forward(token.address, 0, '0x50bff6bf', { from: accounts[0] });
    } catch (err) {
      assertJump(err);
    }
  });
});