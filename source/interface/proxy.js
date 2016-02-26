/**
 * Created by Oleg Galaburda on 25.02.16.
 */
var WorkerInterface = (function() {
  function createInterfaceDefinitionProxy(target) {
    return new Proxy(target, {
      construct: function(targetDefinition, args) {
        var target = new WorkerInterfaceBase(args[0], args[1], args[2], args[3]); // new WorkerInterfaceBase(...args);
        return createInterfaceProxy(target);
      }
    });
  }

  function createInterfaceProxy(target) {
    var proxy = createTargetPoolProxy(target);
    /*FIXME In this case Proxy:set() method will be called, Need another way to setup properties. GET moethod canbe used with hasOwnProperty() or (name in target)
    proxy.get = target.get;
    proxy.set = target.set;
    proxy.call = target.call;
    proxy.execute = target.execute;
    proxy.addEventListener = target.addEventListener;
    proxy.hasEventListener = target.hasEventListener;
    proxy.removeEventListener = target.removeEventListener;
    proxy.removeAllEventListeners = target.removeAllEventListeners;
    proxy.dispatchEvent = target.dispatchEvent;
    */
    Object.defineProperties(proxy, {
      pool: {
        get: function() {
          return target.pool;
        },
        set: function(value) {
          return target.pool = value;
        }
      },
      target: {
        value: target
      }
    });
    return proxy;
  }

  function createTargetPoolProxy(target) {
    var proxy = new Proxy(target, {
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
        return target.get(name).then(function(value) {
          if(value instanceof TargetPool){
            return createTargetPoolProxy(value);
          }
        });
      },
      apply: function(target, thisValue, args) {
        // FIXME call without name means call should be applied to target, so if target is function it should be called.
        return target.call(null, args);
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
    return proxy;
  }

  var definition = null;
  var proxyEnabled = typeof(Proxy) === 'function';
  if (proxyEnabled) {
    definition = createInterfaceProxy(WorkerInterfaceBase);
  } else {
    function WorkerInterface(importScriptURLs, type) {
      WorkerInterfaceBase.apply(this, arguments);
    }
    definition = WorkerInterface;
  }
  Object.defineProperties(definition, {
    proxyEnabled: {
      value: proxyEnabled
    }
  });
  return definition;
})
();
