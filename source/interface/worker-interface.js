/**
 * Created by Oleg Galaburda on 26.02.16.
 */

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
