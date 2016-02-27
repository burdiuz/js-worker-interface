/**
 * Created by Oleg Galaburda on 25.02.16.
 */
var WorkerInterface = (function() {
  var definition = null;
  if (typeof(Proxy) === 'function') {

    definition = (function() {

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
            return [];
          }
        };
      }

      var RequestTargetAllowed = {
        'target': true,
        'then': true,
        'catch': true,
        '_targetLink_': true
      };

      var RequestTargetHandlers = createHandlers(RequestTargetAllowed);

      var WorkerInterfaceAllowed = {
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

      return new Proxy(WorkerInterfaceBase, {
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
      });
    })();
    Object.defineProperties(definition, {
      proxyEnabled: {
        value: true
      }
    });
  } else {
    //=include base-interface.js
    definition = WorkerInterface;
  }
  return definition;
})();
