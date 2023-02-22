// An upgradeable-style initializer with no guard against being called
// more than once - anyone can call it after deployment and take
// ownership, the bug class behind the Wormhole and Audius proxy
// takeover incidents.
pragma solidity 0.8.24;

contract UnguardedInitializer {
  address public owner;

  function initialize(address _owner) public {
    owner = _owner;
  }
}
