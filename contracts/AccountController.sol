pragma solidity ^0.4.7;
import "AccountProxy.sol";

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
  
  // the address of a key the operator keeps secure
  // used to change the signerAddr, if user lost privKey
  address public recovery;
  
  mapping(bytes32 => bool) public nonceMap;

  event Event(bytes32 action);
  event Error(bytes32 error);
  // 403 Access Forbidden
  // 409 Conflict - nonce used before
 
  modifier onlyRecovery() {
    if (msg.sender == recovery) {
      _;
    } else {
      // Access denied.
      Error(0x4163636573732064656e6965642e);
    }
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
    version = 000100; // read as 0.1.0
    proxy = _proxy;
    signer = _signer;
    recovery = _recovery;
    timeLock = _timeLock;
  }

  function forward(bytes32 _nonceAndAddr, bytes _data, bytes32 _r, bytes32 _s, uint8 _v) {
    // 1. parse data
    // expected _nonceAndAddr: <12bytes nonce><20bytes destination>
    // for send only, use this sig: proxySend(uint256 amount)
    address destination;
    uint value = 0;
    assembly {
      // set destination
      destination := _nonceAndAddr

      //expect functionSig bc946030 for proxySend(uint256)
      let name := and(mload(add(_data, 4)),0xffffffff)
      jumpi(end, iszero(eq(name, 0xbc946030)))
      value := mload(add(_data, 34))
      end:
    }
    
    // 2. check permission
    // nonce should not have been used before
    if (nonceMap[_nonceAndAddr]) {
      // Nonce conflict.
      Error(0x4e6f6e636520636f6e666c6963742e);
      return;
    }
    nonceMap[_nonceAndAddr] = true;
    // check signer
    if (ecrecover(sha3(_nonceAndAddr, _data), _v, _r, _s) != signer) {
      // Access denied.
      Error(0x4163636573732064656e6965642e);
      return;
    }
    
    // 3. do stuff
    if (value > 0) {
      AccountProxy(proxy).send(destination, value);
    } else {
      AccountProxy(proxy).forward(destination, _data);
    }
  }

  function forwardTx(address _destination, bytes _payload) onlySigner {
    AccountProxy(proxy).forward(_destination, _payload);
  }

  function sendTx(address _destination, uint _value) onlySigner {
    AccountProxy(proxy).send(_destination, _value);
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

  function changeSigner(address _newSigner) onlyRecovery {
    signer = _newSigner;
    // Account signer changed.
    Event(0x4163636f756e74207369676e6572206368616e6765642e);
  }

}
