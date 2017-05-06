pragma solidity ^0.4.8;

import "./AccountProxy.sol";

contract AccountController {

  // constants
  uint96 public version;

  // address of the proxy contract
  // this is the identity of the user
  address public proxy;

  // lock time before controller change
  uint96 public timeLock; // use 259200 for 3 days

  // the address of the key the user generates in the browser
  // will send signed receipts that shall be forwarded
  address public signer;

  uint96 public newControllerPendingUntil;
  address public newController;

  uint96 public newRecoveryPendingUntil;
  address public newRecovery;

  // last nonce used by signer
  // for valid transactions next receipt has to carry last nonce + 1
  uint96 public lastNonce;
  // the address of a key the operator keeps secure
  // used to change the signerAddr, if user lost privKey
  address public recovery;

  address factory;

  event Event(bytes32 action);
  event Error(bytes32 error);

  modifier onlyRecovery(bytes32 _r, bytes32 _s) {
    uint8 v;
    uint56 target;
    uint248 rest;

    assembly {
        v := calldataload(37)
        target := calldataload(44)
        rest := calldataload(68)
    }

    if (target != uint56(address(this))) {
      // Access denied.
      Error(0x4163636573732064656e6965642e);
      return;
    }
        
    if (ecrecover(sha3(uint8(0), rest), v, _r, _s) != recovery) {
      // Access denied.
      Error(0x4163636573732064656e6965642e);
      return;
    }
    _;
  }

  modifier onlySigner() {
    if (msg.sender == signer) {
      _;
    } else {
      // Access denied.
      Error(0x4163636573732064656e6965642e);
    }
  }

  modifier onlySignerOrProxy() {
    if (msg.sender == signer || msg.sender == proxy) {
      _;
    } else {
      // Access denied.
      Error(0x4163636573732064656e6965642e);
    }
  }

  modifier onlySignerOrRecovery() {
    if (msg.sender == signer || msg.sender == recovery) {
      _;
    } else {
      // Access denied.
      Error(0x4163636573732064656e6965642e);
    }
  }

  modifier onlySignerOrProxyOrRecovery() {
    if (msg.sender == signer || msg.sender == proxy || msg.sender == recovery) {
      _;
    } else {
      // Access denied.
      Error(0x4163636573732064656e6965642e);
    }
  }

  function AccountController(address _proxy, address _signer, address _recovery, uint96 _timeLock) {
    version = 100; // read as 0.1.0
    proxy = _proxy;
    signer = _signer;
    recovery = _recovery;
    timeLock = _timeLock;
    factory = msg.sender;
  }

  function forward(bytes32 _r, bytes32 _s, bytes32 _pl, uint _amount, bytes _data) {
    uint8 v;
    uint56 target;
    uint32 nonce;
    address destination;

    assembly {
        v := calldataload(37)
        target := calldataload(44)
        nonce := calldataload(48)
        destination := calldataload(68)
    }

    // 2. check permission
    if (target != uint56(address(this))) {
      // Access denied.
      Error(0x4163636573732064656e6965642e);
      return;
    }
    if (nonce != lastNonce + 1) {
      // Invalid nonce
      Error(0x4e6f6e636520636f6e666c6963742e);
      return;
    }
    lastNonce = nonce;
    // check signer
    if (ecrecover(sha3(uint8(0), target, nonce, destination, _amount, _data), v, _r, _s) != signer) {
      // Access denied.
      Error(0x4163636573732064656e6965642e);
      return;
    }

    // 3. do stuff
    AccountProxy(proxy).forward(destination, _amount, _data);
  }

  function signControllerChange(address _newController) onlySigner {
    newControllerPendingUntil = uint96(now) + timeLock;
    newController = _newController;
    // signControllerChange called.
    Event(0x7369676e436f6e74726f6c6c65724368616e67652063616c6c65642e);
  }

  function changeController() {
    if (newControllerPendingUntil >= now) {
      // PendingUntil not exceeded.
      Error(0x50656e64696e67556e74696c206e6f742065786365656465642e);
      return;
    }
    if (newController == 0x0) {
      // newController is 0x0.
      Error(0x6e6577436f6e74726f6c6c6572206973203078302e);
      return;
    }
    AccountProxy(proxy).transfer(newController);
    suicide(newController);
  }

  function signRecoveryChange(address _newRecovery) onlySignerOrProxyOrRecovery {
    newRecoveryPendingUntil = uint96(now) + timeLock;
    newRecovery = _newRecovery;
    // signRecoveryChange called.
    Event(0x7369676e5265636f766572794368616e67652063616c6c65642e);
  }

  function changeRecovery() {
    if (newRecoveryPendingUntil >= now) {
      // PendingUntil not exceeded.
      Error(0x50656e64696e67556e74696c206e6f742065786365656465642e);
      return;
    }
    if (newRecovery == 0x0) {
      // newRecovery is 0x0.
      Error(0x6e65775265636f76657279206973203078302e);
      return;
    }
    recovery = newRecovery;
    newRecovery = 0x0;
    newRecoveryPendingUntil = 0;
    // Change Recovery called.
    Event(0x4368616e6765205265636f766572792063616c6c65642e);
  }

  function changeSigner(bytes32 _r, bytes32 _s, bytes32 _pl) onlyRecovery(_r, _s) {
    uint32 nonce;
    address newSigner;
    bytes memory data = new bytes(68);
    address oldSigner = signer;

    assembly {
      nonce := calldataload(48)
      newSigner := calldataload(68)
      // bytes4(sha3("handleRecovery(address,address)"))
      mstore(add(data, 32), 0x5583b69300000000000000000000000000000000000000000000000000000000)
      mstore(add(data, 36), oldSigner)
      mstore(add(data, 68), newSigner)
    }

    if (nonce != lastNonce + 1) {
      // Invalid nonce
      Error(0x4e6f6e636520636f6e666c6963742e);
      return;
    }
    lastNonce = nonce;

    AccountProxy(proxy).forward(factory, 0, data);
    signer = newSigner;
    // Account signer changed.
    Event(0x4163636f756e74207369676e6572206368616e6765642e);
  }

}
