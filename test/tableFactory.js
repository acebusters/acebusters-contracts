const TableFactory = artifacts.require('../contracts/TableFactory.sol');
var Table = artifacts.require('../contracts/Table.sol');
const assertJump = require('./helpers/assertJump');

contract("TableFactory", (accounts) => {

  it("Correctly deploys single table", async () => {
    const oracle = accounts[1];
    const token = accounts[1];
    const factory = await TableFactory.new();
    await factory.configure(token, oracle, 0);
    await factory.create([50], 1, 8);
    const tables = await factory.getTables.call();
    assert.equal(tables.length, 1, 'table not created.');
  });

  it("allow deploying for admins", async () => {
    const oracle = accounts[1];
    const token = accounts[1];
    const factory = await TableFactory.new();
    await factory.configure(token, oracle, 0);
    await factory.addAdmin(accounts[2]);
    await factory.create([50], 1, 8, { from: accounts[2] });
    const tables = await factory.getTables.call();
    assert.equal(tables.length, 1, 'table not created.');
  });

  it("doesn't allow deploying table for non-admins", async () => {
    const oracle = accounts[1];
    const token = accounts[1];
    const factory = await TableFactory.new();
    await factory.configure(token, oracle, 0);

    try {
      await factory.create([50], 1, 8, { from: accounts[2] });
      assert.fail('should have thrown before');
    } catch (err) {
      assertJump(err);
    }
  });

  it("Correctly deploy multiple tables", async () => {
    const oracle = accounts[1];
    const token = accounts[1];
    const factory = await TableFactory.new();
    await factory.configure(token, oracle, 0);
    await factory.create([50], 1, 2);
    await factory.create([100], 1, 4);
    await factory.create([150], 1, 6);
    await factory.create([250], 1, 8);
    await factory.create([350], 1, 10);
    const tables = await factory.getTables.call();
    assert.equal(tables.length, 5, 'tables not created.');
  });

});
