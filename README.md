### installation

```
npm install
npm i -g truffle@3.4.5
```

### run tests

```
npm test
```

or run individual tests like this:

```
npm test test/table.js
```

### code coverage

```
npm run coverage
```

Executes instrumented tests on a separate testrpc. Coverage report is dumped to the terminal and into `coverage/index.html` (Istanbul HTML format)

### Use truffle with mainnet/rinkeby

We use remote Infura node to connect to mainnet, thus you have to provide mnemonic for truffle to sign your transactions. Create `.env` file with your mnemonic and, optionally, index of the account to use. Use `.env.template` as a template.

Then use `mainnet` network for your truffle commands. E.g. `truffle console --network mainnet`

For rinkeby network use `truffle console --network rinkeby`

Some commands:

**Deploy new table factory:**

Run in truffle console
```
TableFactory.new()
```
once the tx is mined get the address of new TableFactory contract and configure the factory (take the actual arguments from the previous contract):

```
TableFactory.at("<contract address>").configure("0x84e18564498531da0858a36a44f60d24d8e947bd", "0x82e8c6cf42c8d1ff9594b17a3f50e94a12cc860f", 0)
```

**Create new table**

```
TableFactory.at("<table factory addr>").create(1000000000000, 2)
```

**Add more admins to TableFactory**

```
TableFactory.at("<table factory addr>").addAdmin("<address for another admin>")
```

## License
Code released under the [MIT License](https://github.com/acebusters/contracts/blob/master/LICENSE).
