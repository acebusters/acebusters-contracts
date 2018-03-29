// Increases testrpc time by the `time` duration in seconds
export default function increaseTime(time) {
  return web3.currentProvider.sendAsync({
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [time], // 86400 seconds in a day
          id: new Date().getTime()},
          () => {}
        );
}
