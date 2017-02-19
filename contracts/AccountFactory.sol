pragma solidity ^0.4.7;
import "AccountController.sol";
import "AccountProxy.sol";

contract AccountFactory {

  event AccountCreated(address indexed signer, address proxy, address controller, address recovery);

  mapping(address => address) public signerToProxy;

  function create(address _signer, address _recovery, uint _timeLock) {
    AccountProxy proxy = new AccountProxy();
    AccountController controller = new AccountController(proxy, _signer, _recovery, uint96(_timeLock));
    proxy.transfer(controller);

    AccountCreated(_signer, proxy, controller, _recovery);
    signerToProxy[_signer] = proxy;
  }

}
