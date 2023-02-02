// A generic proxy that delegatecalls to whatever address the caller
// names - any caller can point it at arbitrary code with full access to
// this contract's own storage.
pragma solidity 0.8.24;

contract ProxyHijack {
  function execute(address target, bytes calldata data) external {
    (bool ok, ) = target.delegatecall(data);
    require(ok, "delegatecall failed");
  }
}
