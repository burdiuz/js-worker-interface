WorkerInterface = (function() {

  function createHandlers(exclustions) {
    return {
      'get': function(wrapper, name) {
        var value;
        if (exclustions[name]) {
          value = wrapper.target[name];
        } else {
          var child = wrapper.target.get(name);

          function childTargetWrapper() {
            return child;
          }

          childTargetWrapper.target = child;
          value = createRequestTargetProxy(childTargetWrapper);
        }
        return value;
      },
      'apply': function(wrapper, thisValue, args) {
        return createRequestTargetProxy(wrapper.target.call(null, args));
      },
      'set': function(wrapper, name, value) {
        var result;
        if (exclustions[name]) {
          result = wrapper.target[name] = value;
        } else {
          result = wrapper.target.set(name, value);
        }
        return result;
      },
      'has': function(wrapper, name) {
        return Boolean(exclustions[name]);
      },
      'deleteProperty': function(wrapper, name) {
        return false;
      },
      'ownKeys': function(wrapper) {
        return Object.getOwnPropertyNames(exclustions);
      },
      'enumerate': function(wrapper) {
        return Object.getOwnPropertyNames(exclustions);
      },
      'getOwnPropertyDescriptor': function(wrapper, name) {
        //TODO Property descriptors should be prohibited or fixed
        var descr;
        if (FunctionExclustions[name]) {
          descr = Object.getOwnPropertyDescriptor(wrapper, name);
        }else{
          descr = Object.getOwnPropertyDescriptor(wrapper.target, name);
        }
        console.log(name, wrapper.target, descr);
        return descr;
      }
    };
  }

  var FunctionExclustions = {
    'arguments': true,
    'caller': true,
    'prototype': true
  };

  // Look if toJSON should be added to allowed
  var RequestTargetAllowed = {
    /*
     INFO arguments and caller were included because they are required function properties
     https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/arguments
     */
    'arguments': true,
    'caller': true,
    'prototype': true,
    //---------
    'get': true,
    'set': true,
    'call': true,
    'execute': true,
    'target': true,
    'then': true,
    'catch': true,
    '_targetLink_': true
  };

  var RequestTargetHandlers = createHandlers(RequestTargetAllowed);

  var WorkerInterfaceAllowed = {
    'arguments': true,
    'caller': true,
    'prototype': true,
    'get': true,
    'set': true,
    'call': true,
    'execute': true,
    'target': true,
    'dispatcher': true,
    'then': true,
    'catch': true,
    'pool': true
  };

  var WorkerInterfaceHandlers = createHandlers(WorkerInterfaceAllowed);

  function createRequestTargetProxy(wrapper) {
    return new Proxy(wrapper, RequestTargetHandlers);
  }

  var WorkerInterface = new Proxy(WorkerInterfaceBase, {
    'construct': function(targetDefinition, args) {
      var target = new targetDefinition(args[0], args[1], args[2], args[3]); // new WorkerInterfaceBase(...args);
      //INFO targetWrapper needs for "apply" interceptor, it works only for functions as target
      function targetWrapper() {
        return target;
      }

      targetWrapper.target = target;
      return new Proxy(targetWrapper, WorkerInterfaceHandlers);
    },
    'get': function(target, name) {
      return target[name];
    },
    'set': function(target, name, value) {
      target[name] = value;
    },
    'has': function(target, name) {
      return target.hasOwnProperty(name);
    },
    'ownKeys': function(target) {
      return Object.getOwnPropertyNames(target);
    },
    'deleteProperty': function(target, name) {
      delete target[name];
    }
  });

  Object.defineProperties(WorkerInterface, {
    proxyEnabled: {
      value: true
    }
  });

  return WorkerInterface;
})();
