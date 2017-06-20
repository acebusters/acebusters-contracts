const TableFactory = artifacts.require('../contracts/TableFactory.sol');
var Table = artifacts.require('../contracts/Table.sol');

contract("TableFactory", (accounts) => {

  it("Correctly deploys single table", async () => {
    const oracle = accounts[1];
    const token = accounts[1];
    const factory = await TableFactory.new();
    await factory.configure(token, oracle);
    await factory.create(50, 8);
    const tables = await factory.getTables.call();
    assert.equal(tables.length, 1, 'table not created.');
  });

  it("Correctly deploy multiple tables", async () => {
    const oracle = accounts[1];
    const token = accounts[1];
    const factory = await TableFactory.new();
    await factory.configure(token, oracle);
    await factory.create(50, 2);
    await factory.create(100, 4);
    await factory.create(150, 6);
    await factory.create(250, 8);
    await factory.create(350, 10);
    const tables = await factory.getTables.call();
    assert.equal(tables.length, 5, 'tables not created.');
  });

});