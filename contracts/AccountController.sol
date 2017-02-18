pragma solidity ^0.4.7;
import "AccountProxy.sol";

contract AccountController {

  // constants
  uint96 public version;
  
  // address of the proxy contract
  // this is the identity of the user
  address public proxyAddr;

  // lock time before controller change
  uint96 public timeLock; // use 259200 for 3 days

  // the address of the key the user generates in the browser
  // will send signed receipts that shall be forwarded
  address public signerAddr;

  uint96 public proposedControllerPendingUntil;  
  address public proposedController;

  
  // the address of a key the operator keeps secure
  // used to change the signerAddr, if user lost privKey
  address public recoveryAddr;
  
  mapping(uint => bool) public nonceMap;

  event RecoveryEvent(string action, address initiatedBy);
 
  modifier onlyRecoveryAddr() {
      if (msg.sender == recoveryAddr) {
          _;
      }
  }

  modifier onlySignerAddr() {
      if (msg.sender == signerAddr) {
          _;
      }
  }

  function AccountController(address _proxyAddr, address _signerAddr, uint96 _timeLock) {
    version = 000100; // read as 0.1.0
    proxyAddr = _proxyAddr;
    signerAddr = _signerAddr;
    timeLock = _timeLock;
    recoveryAddr = msg.sender;
  }

  function forward(bytes _data, bytes _sig) {
    // 1. parse data
    // expected data: <4bytes sig><12bytes nonce><20bytes destination>...
    // for send only, use this sig: proxySend(bytes32 nonceAndAddr, uint256 amount)
    address destination;
    uint nonceAndAddr;
    uint value = 0;
    bytes32 r;
    bytes32 s;
    uint8 v;
    assembly {
        let name := and(mload(add(_data, 4)),0xffffffff)
        nonceAndAddr := mload(add(_data, 36))
        // set destination
        destination := nonceAndAddr
        //expect functionSig bc946030 for proxySend(bytes32, uint256)
        jumpi(sig, iszero(eq(name, 0xbc946030)))
        value := mload(add(_data, 68))
        sig:
            r := mload(add(_sig, 32))
            s := mload(add(_sig, 64))
            v := mload(add(_sig, 65))
    }
    
    // 2. check permission
    // nonce should not have been used before
    if (nonceMap[nonceAndAddr]) {
        throw;
    }
    // check signer
    if (ecrecover(sha3(_data), v, r, s) != signerAddr)
        throw;
    
    // 3. do stuff
    nonceMap[nonceAndAddr] = true;
    if (value > 0) {
      AccountProxy(proxyAddr).send(destination, value);
    } else {
      AccountProxy(proxyAddr).forward(destination, _data);
    }
  }

  function forwardTx(address _destination, bytes _payload) onlySignerAddr {
    AccountProxy(proxyAddr).forward(_destination, _payload);
  }

  function send(address _destination, uint _value) onlySignerAddr {
    AccountProxy(proxyAddr).send(_destination, _value);
  }
  
  function signControllerChange(bytes _receipt) {
    // 1. parse data
    uint32 name; // name of function to call 
    uint nonce;  // nonce for receipt, to prevent replay
    address control; // pass 0x0 to cancel 
    // todo: check that controller exists
    bytes32 r;
    bytes32 s;
    uint8 v;
    assembly {
        name := and(mload(add(_receipt, 4)),0xffffffff)
        nonce := mload(add(_receipt, 36))
        control := mload(add(_receipt, 68))
        r := mload(add(_receipt, 100))
        s := mload(add(_receipt, 132))
        v := mload(add(_receipt, 133))
    }
    
    // 2. check permission
    // nonce should not have been used before
    if (nonceMap[nonce]) {
        throw;
    }
    // check signer
    address signer = ecrecover(sha3(bytes4(name), nonce, bytes32(control)), v, r, s);
    if (signer != signerAddr)
        throw;
    
    // 3. do things
    nonceMap[nonce] = true;
    proposedControllerPendingUntil = uint96(now) + timeLock;
    proposedController = control;
    RecoveryEvent("signControllerChange", signer);
  }
  
  function signControllerChange(address _newController) onlySignerAddr {
    proposedControllerPendingUntil = uint96(now) + timeLock;
    proposedController = _newController;
    RecoveryEvent("signControllerChange", msg.sender);
  }

  function changeController() {
    if(proposedControllerPendingUntil < now && proposedController != 0x0) {
      var proxy = AccountProxy(proxyAddr);
      proxy.transfer(proposedController);
      suicide(proposedController);
    }
  }
  
  function changeRecoveryAddr(address _newRecoveryAddr) onlyRecoveryAddr {
      recoveryAddr = _newRecoveryAddr;
      RecoveryEvent("changeRecoveryAddr", msg.sender);
  }

  function changeUserAddr(address _newsignerAddr) onlyRecoveryAddr {
    signerAddr = _newsignerAddr;
    RecoveryEvent("changeUserAddr", msg.sender);
  }

}
