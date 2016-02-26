/**
 * Created by Oleg Galaburda on 19.02.16.
 */

var CommandType = {
  GET: 'get',
  SET: 'set',
  CALL: 'call',
  EXEC: 'exec',
  DESTROY_TARGET: 'destroyTarget'
};

var Events = {
  REQUEST_EVENT: '~WI:Request',
  RESPONSE_EVENT: '~WI:Response'
};

var ResponseTypes = {
  RESULT_SUCCESS: 'success',
  RESULT_FAILURE: 'failure'
};

var getId = (function() {
  var _base = 'WI/' + String(Date.now()) + '/';
  var _index = 0;
  return function() {
    return _base + String(++_index) + '/' + String(Date.now());
  };
})();

var createDeferred = (function() {
  function Deferred() {
    this.promise = new Promise(function(resolve, reject) {
      this.resolve = resolve;
      this.reject = reject;
    }.bind(this));
  }

  function createDeferred() {
    return new Deferred();
  }

  return createDeferred;
})();

function unpackTargets(value) {
  if (typeof(value) !== 'object' || value === null) {
    return value;
  }
  if (RequestTargetLink.isLink(value)) {

  }
}

//TODO If RequestTarget, RequestTargetLink or their proxies are passed, they should be converted to RAW links.
function packTargets(data) {
  var result = data;
  if (typeof(data) && data !== null) {
    if (RequestTargetLink.isLink(data)) {
      if (data instanceof RequestTarget) {
        result = data.toJSON();
      } else {
        result = data;
      }
    } else if (data instanceof Array) {
      result = [];
      var length = data.length;
      for (var index = 0; index < length; index++) {
        var value = data[index];
        if (value instanceof RequestTarget) {

        }
      }
    } else if (data.constructor === Object) {
      result = {};
      for (var name in data) {
        if (!data.hasOwnProperty(name)) continue;
        var value = data[name];
        if (value instanceof RequestTarget) {
          value = value.toJSON();
        }
        result[name] = value;
      }
    }
  }
  return result;
}

function evaluateRequest(type, cmd, value, target) {
  var handler, result = undefined;
  switch (type) {
    case CommandType.CALL:
      with (target) {
        eval('handler = ' + cmd);
        result = handler.apply(target, value);
      }
      break;
    case CommandType.EXEC:
      with (target) {
        eval('result = (function(target) { with(target){ return ' + cmd + '; }})(target);');
        /*
         eval('result = ' + cmd);
         */
      }
      break;
    case CommandType.GET:
      with (target) {
        eval('result = ' + cmd);
      }
      break;
    case CommandType.SET:
      eval('handler = function(value, target) { with(target) { ' + cmd + ' = value; } };');
      handler(value, target);
      /*
       handler = new Function('value,target', 'with(target){ ' + cmd + ' = value; }');
       handler(value, target);
       */
      break;
    case CommandType.DESTROY_TARGET:
      TargetPool.instance.remove(target);
      break;
  }
  return result;
}
