// The fixed counterpart to fixtures/vulnerable/unguarded-initializer.sol:
// a real initializer modifier prevents a second call.
pragma solidity 0.8.24;

contract GuardedInitializer {
  address public owner;
  bool private initialized;

  modifier initializer() {
    require(!initialized, "already initialized");
    initialized = true;
    _;
  }

  function initialize(address _owner) public initializer {
    owner = _owner;
  }
}
