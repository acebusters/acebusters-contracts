#!/usr/bin/env bash

# Based on https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/scripts/test.sh

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the testrpc instance that we started (if we started one and if it's still running).
  if [ -n "$testrpc_pid" ] && ps -p $testrpc_pid > /dev/null; then
    kill -9 $testrpc_pid
  fi
}

testrpc_running() {
  nc -z localhost 8545
}

if testrpc_running; then
  echo "Using existing testrpc instance"
else
  echo "Starting our own testrpc instance"
  testrpc --account="0x995fc6621693627bcf30257470d5ab1f3a44ce2f387fe50a8985999e14469b7d, 100000000000000000000" \
  --account="0xc21232c011bc6fda8250ab4d7ced7e8ca92dacac743d690ad5c94a219c4fe076, 100000000000000000000" \
  --account="0x4b20b3afe5510f41c2ce56981d012ade2bea37b31bf13e44f11271ce7343846b, 100000000000000000000" \
  --account="0xf93351c9b13424273076ef7892771c80feeca8f26126a401669b4dd95d0d2531, 100000000000000000000" \
  --account="0xec600b5555a30fcf9f1b06a2f17b0f538a7233ea2babb5aa3ceecaa28cbb7c78, 100000000000000000000" \
  --account="0xbb6bde16e3c48b17352977baf059718d810001e9447323961d92b94130275438, 100000000000000000000" \
  > /dev/null &
  testrpc_pid=$!
fi

node_modules/.bin/truffle test "$@"
