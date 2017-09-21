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

### Legacy testrpc setup

```
testrpc --account="0x278a5de700e29faae8e40e366ec5012b5ec63d36ec77e8a2417154cc1d25383f,999999999999999999999" --account="0x7bc8feb5e1ce2927480de19d8bc1dc6874678c016ae53a2eec6a6e9df717bfac,999999999999999999999", --account="0x71d2b12dad610fc929e0596b6e887dfb711eec286b7b8b0bdd742c0421a9c425,999999999999999999999" --account="0x94890218f2b0d04296f30aeafd13655eba4c5bbf1770273276fee52cbe3f2cb4,999999999999999999999"
```

## License
Code released under the [MIT License](https://github.com/acebusters/contracts/blob/master/LICENSE).
