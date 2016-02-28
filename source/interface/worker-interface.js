WorkerInterface = (function() {
  function WorkerInterface(importScriptURLs, type) {
    WorkerInterfaceBase.apply(this, arguments);
  }

  Object.defineProperties(WorkerInterface, {
    proxyEnabled: {
      value: false
    }
  });

  return WorkerInterface;
})();
