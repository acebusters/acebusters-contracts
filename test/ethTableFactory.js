const EthTableFactory = artifacts.require('../contracts/EthTableFactory.sol');
var SnGTable = artifacts.require('../contracts/SnGTable.sol');
const assertJump = require('./helpers/assertJump');
import {advanceBlock} from './helpers/advanceToBlock';
import latestTime from './helpers/latestTime';


contract("EthTableFactory", (accounts) => {

  it("Correctly deploys single table", async () => {
    await advanceBlock();
    const startTime = latestTime();

    const oracle = accounts[1];
    const token = accounts[1];
    const factory = await EthTableFactory.new();
    await factory.configure(token, oracle, 0);
    await factory.create(50, 8, 604800, 86400);
    const tables = await factory.getTables.call();
    assert.equal(tables.length, 1, 'table not created.');
    const tableAddr = await factory.tables.call(0);
    const table = SnGTable.at(tableAddr);

    // check table details
    const restartTime = await table.restartTime.call();;
    const coolOffPeriod = await table.coolOffPeriod.call();
    const registrationPeriod = await table.registrationPeriod.call();

    assert.equal(restartTime.toNumber(), startTime, 'table restartTime not correct.');
    assert.equal(coolOffPeriod.toNumber(), 604800, 'table restartTime not correct.');
    assert.equal(registrationPeriod.toNumber(), 86400, 'table restartTime not correct.');
  });

  it("allow deploying for admins", async () => {
    const oracle = accounts[1];
    const token = accounts[1];
    const factory = await EthTableFactory.new();
    await factory.configure(token, oracle, 0);
    await factory.addAdmin(accounts[2]);
    await factory.create(50, 8, 604800, 86400, { from: accounts[2] });
    const tables = await factory.getTables.call();
    assert.equal(tables.length, 1, 'table not created.');
  });

  it("doesn't allow deploying table for non-admins", async () => {
    const oracle = accounts[1];
    const token = accounts[1];
    const factory = await EthTableFactory.new();
    await factory.configure(token, oracle, 0);

    try {
      await factory.create(50, 8, 604800, 86400, { from: accounts[2] });
      assert.fail('should have thrown before');
    } catch (err) {
      assertJump(err);
    }
  });

  it("Correctly deploy multiple tables", async () => {
    const oracle = accounts[1];
    const token = accounts[1];
    const factory = await EthTableFactory.new();
    await factory.configure(token, oracle, 0);
    await factory.create(50, 2, 604800, 86400);
    await factory.create(100, 4, 604800, 86400);
    await factory.create(150, 6, 604800, 86400);
    await factory.create(250, 8, 604800, 86400);
    await factory.create(350, 10, 604800, 86400);
    const tables = await factory.getTables.call();
    assert.equal(tables.length, 5, 'tables not created.');
  });

});
