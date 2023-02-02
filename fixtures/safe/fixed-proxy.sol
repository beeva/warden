// The fixed counterpart to fixtures/vulnerable/proxy-hijack.sol: the
// delegatecall target is a fixed address set once at deploy time, never
// a caller-supplied parameter.
pragma solidity 0.8.24;

contract FixedProxy {
  address public immutable implementation;

  constructor(address impl) {
    implementation = impl;
  }

  fallback() external payable {
    (bool ok, ) = implementation.delegatecall(msg.data);
    require(ok, "delegatecall failed");
  }
}
