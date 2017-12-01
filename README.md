### installation

```
npm install
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

### Use truffle with mainnet

We use remote Infura node to connect to mainnet, thus you have to provide mnemonic for truffle to sign your transactions. Create `.env` file with your mnemonic and, optionally, index of the account to use. Use `.env.template` as a template.

Then use `mainnet` network for your truffle commands. E.g. `truffle console --network mainnet`


## License
Code released under the [MIT License](https://github.com/acebusters/contracts/blob/master/LICENSE).
