import { Receipt } from 'poker-helper';
const AccountProxy = artifacts.require('../contracts/AccountProxy.sol');
const AccountController = artifacts.require('../contracts/AccountController.sol');
const Token = artifacts.require('../contracts/Token.sol');

contract("AccountController", (accounts) => {

  const SIGNER_ADDR = '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74';
  const SIGNER_PRIV = '0x278a5de700e29faae8e40e366ec5012b5ec63d36ec77e8a2417154cc1d25383f';
  const RECOVERY_ADDR = '0x82e8c6cf42c8d1ff9594b17a3f50e94a12cc860f';
  const RECOVERY_PRIV = '0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4';

  let wait = (seconds) => new Promise((resolve) => setTimeout(() => resolve(), seconds * 1000));

  it("Correctly deploys contract", async () => {
    const signer = accounts[0];
    const recovery = accounts[1];
    const proxy = await AccountProxy.new();
    const token = await Token.new();
    const controller = await AccountController.new(proxy.address, signer, recovery, 0);
    const proxyAddr = await controller.proxy.call();
    assert.equal(proxyAddr, proxy.address);
    const signerAddr = await controller.signer.call();
    assert.equal(signerAddr, signer);
    const recoveryAddr = await controller.recovery.call();
    assert.equal(recoveryAddr, recovery);
  });

  it("sends transactions by receipt", async () => {
    // create proxy and controller
    const proxy = await AccountProxy.new();
    const token = await Token.new();
    const controller = await AccountController.new(proxy.address, SIGNER_ADDR, accounts[0], 0);
    await proxy.transfer(controller.address);
    // construct a receipt, sign and send
    // issue 2000 in token through proxy
    const data = 'cc872b6600000000000000000000000000000000000000000000000000000000000007d0';
    const forwardReceipt = new Receipt(controller.address).forward(1, token.address, 0, data).sign(SIGNER_PRIV);
    await controller.forward(...Receipt.parseToParams(forwardReceipt));
    // verify that receipt has been executed
    // Verify that the proxy address is logged as the sender
    const bal = await token.balanceOf.call(proxy.address);
    assert.equal(bal.toNumber(), 2000, "should be able to proxy transaction");
  });

  it("should prevent submitting wrong nonce", async () => {
    // create proxy and controller
    const proxy = await AccountProxy.new();
    const token = await Token.new();
    const controller = await AccountController.new(proxy.address, SIGNER_ADDR, accounts[0], 0);
    await proxy.transfer(controller.address);
    // construct a receipt, sign and send
    // issue 2000 in token through proxy
    const data = 'cc872b6600000000000000000000000000000000000000000000000000000000000007d0';
    const forwardReceipt = new Receipt(controller.address).forward(1, token.address, 0, data).sign(SIGNER_PRIV);
    await controller.forward(...Receipt.parseToParams(forwardReceipt));
    // verify that receipt has been executed
    // Verify that the proxy address is logged as the sender
    let bal = await token.balanceOf.call(proxy.address);
    assert.equal(bal.toNumber(), 2000, "should be able to proxy transaction");
    // same operation as above with wrong nonce
    const data2 = 'cc872b6600000000000000000000000000000000000000000000000000000000000007d0';
    const forwardReceipt2 = new Receipt(controller.address).forward(3, token.address, 0, data2).sign(SIGNER_PRIV);
    await controller.forward(...Receipt.parseToParams(forwardReceipt2));
    // verify that receipt has been executed
    // Verify that the proxy address is logged as the sender
    bal = await token.balanceOf.call(proxy.address);
    assert.equal(bal.toNumber(), 2000, "should be able to proxy transaction");
  });

  it("Updates signerAddr as recovery", async () => {
    const signer = accounts[1];
    const newSigner = accounts[2];
    const unknown = accounts[3];
    const proxy = await AccountProxy.new();
    const controller = await AccountController.new(proxy.address, signer, RECOVERY_ADDR, 0);
    // try to change signer address from signer address
    const recoveryReceipt = new Receipt(controller.address).recover(1, newSigner).sign(SIGNER_PRIV);
    await controller.changeSigner(...Receipt.parseToParams(recoveryReceipt));
    let newSignerAddr = await controller.signer.call();
    assert.equal(newSignerAddr, signer, "Only recovery can call changeSignerAddr.");
    const recoveryReceipt2 = new Receipt(controller.address).recover(1, newSigner).sign(RECOVERY_PRIV);
    await controller.changeSigner(...Receipt.parseToParams(recoveryReceipt2));
    newSignerAddr = await controller.signer.call();
    assert.equal(newSignerAddr, newSigner, "Recovery should be able to change signer.");
  });

  it("Updates recoveryAddr as recovery", async () => {
    const signer = accounts[1];
    const newRecovery = accounts[2];
    const unknown = accounts[3];
    const proxy = await AccountProxy.new();
    const controller = await AccountController.new(proxy.address, signer, accounts[0], 0);
    await controller.signRecoveryChange(newRecovery, {from: unknown});
    let recoveryAddr = await controller.newRecovery.call();
    assert.equal(recoveryAddr, 0x0, "Only recovery or signer can call changeRecoveryFromRecovery");
    await controller.signRecoveryChange(newRecovery);
    const newRecoveryAddr = await controller.newRecovery.call();
    assert.equal(newRecoveryAddr, newRecovery, "Recovery should be able to change recovery.");
    await wait(1);
    await controller.changeRecovery({from: signer});
    recoveryAddr = await controller.recovery.call();
    assert.equal(recoveryAddr, newRecovery, "ChangeRecovery Should affect recovery address after longTimeLock period");
  });

  it("Correctly performs transfer", async () => {
    const signer = accounts[1];
    const newController = accounts[2];

    const proxy = await AccountProxy.new();
    const controller = await AccountController.new(proxy.address, signer, accounts[0], 0);
    await proxy.transfer(controller.address);
    await controller.signControllerChange(newController, {from: accounts[2]});
    let newControllerAddr = await controller.newController.call();
    assert.equal(newControllerAddr, 0x0, "Only user can set the newController");
    await controller.signControllerChange(newController, {from: signer});
    newControllerAddr = await controller.newController.call();
    assert.equal(newControllerAddr, newController, "New controller should now be cued up");
    let proxyOwner = await proxy.owner.call();
    assert.equal(proxyOwner, controller.address, "proxy should not change until changeController is called");
    await wait(1);
    await controller.changeController({from: signer});
    proxyOwner = await proxy.owner.call();
    assert.equal(proxyOwner, newController, "ChangeController Should affect proxy ownership after longTimeLock period");
  });
});
