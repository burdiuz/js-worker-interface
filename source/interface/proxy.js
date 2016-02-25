/**
 * Created by Oleg Galaburda on 25.02.16.
 */
var WorkerInterface = (function() {
  var definition = null;
  var proxyEnabled =false;
  if (typeof(Proxy) === 'function') {
    proxyEnabled = true;
    definition = new Proxy(WorkerInterfaceBase, {
      construct: function(targetDefinition, args) {
        var target = new WorkerInterfaceBase(args[0], args[1]);
        return new Proxy(target, {
          /**
           * To make function calls real
           * 1. Return promise
           * 2. use TargetPool to register selected function
           * 3.
           * @param target
           * @param name
           * @param receiver
           * @returns {*}
           */
          get: function(target, name, receiver) {
            return target.get(name);
          },
          set: function(target, name, value, receiver) {
            return target.set(name, value);
          },
          has: function(target, name) {
            return false;
          },
          deleteProperty: function(target, name) {
            return false;
          },
          ownKeys: function(target) {
            return [];
          }
        });
      }
    });
  } else {
    function WorkerInterface(importScriptURLs, type) {
      WorkerInterfaceBase.apply(this, arguments);
    }
  }
  Object.defineProperties(definition, {
    proxyEnabled: {
      value: proxyEnabled
    }
  });
  return definition;
})();
