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
  READY_EVENT: '~WI:Ready',
  REQUEST_EVENT: '~WI:Request',
  RESPONSE_EVENT: '~WI:Response',
  internals: {
    '~WI:Ready': true,
    '~WI:Request': true,
    '~WI:Response': true
  }
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

//TODO If RequestTarget, RequestTargetLink or their proxies are passed, they should be converted to RAW links.
var DataConverter = (function() {

  function convertLinkToRaw(data) {
    if (typeof(data.toJSON) === 'function') {
      data = data.toJSON();
    }
    return data;
  }

  function convertRawToRequestTarget(data, sendRequestHandler) {
    var poolId = RequestTargetLink.getLinkPoolId(data);
    if (poolId === TargetPool.instance.id) { // target object is stored in current pool
      data = TargetPool.instance.get(RequestTargetLink.getLinkId(data));
      if(data) {
        data = data.target;
      }
    } else { // target object has another origin, should be wrapped
      data = new RequestTarget(Promise.resolve(data), sendRequestHandler);
    }
    return data;
  }

  function convertArrayTo(list, linkConvertHandler, sendRequestHandler) {
    var result = [];
    var length = list.length;
    for (var index = 0; index < length; index++) {
      var value = list[index];
      if (RequestTargetLink.isLink(value)) {
        result[index] = linkConvertHandler(value, sendRequestHandler);
      } else {
        result[index] = value;
      }
    }
    return result;
  }

  function convertHashTo(data, linkConvertHandler, sendRequestHandler) {
    var result = {};
    for (var name in data) {
      if (!data.hasOwnProperty(name)) continue;
      var value = data[name];
      if (RequestTargetLink.isLink(data)) {
        result[name] = linkConvertHandler(value, sendRequestHandler);
      } else {
        result[name] = value;
      }
    }
    return result;
  }

  function convertToRaw(data) {
    var result = data;
    var dataType = typeof(data);
    if (dataType === 'object' && data !== null) {
      if (RequestTargetLink.isLink(data)) { // if data is link
        result = convertLinkToRaw(data);
      } else if (data instanceof Array) { // if data is Array of values, check its
        result = convertArrayTo(data, convertLinkToRaw);
      } else if (data.constructor === Object) { // only Object instances can be looked up, other object types must be converted by hand
        result = convertHashTo(data, convertLinkToRaw);
      }
    } else if (dataType === 'function') {
      result = TargetPool.instance.set(data).toJSON();
    }
    return result;
  }

  function prepareToSend(data) {
    if (data) {
      data.value = convertToRaw(data.value);
    }
    return data;
  }

  function convertFromRaw(data, sendRequestHandler) {
    var result = data;
    if (typeof(data) !== 'object' || data === null) {
      return result;
    }
    if (RequestTargetLink.isLink(data)) { // if data is link
      result = convertRawToRequestTarget(data, sendRequestHandler);
    } else if (data instanceof Array) { // if data is Array of values, check its
      result = convertArrayTo(data, convertRawToRequestTarget, sendRequestHandler);
    } else if (data.constructor === Object) {
      result = convertHashTo(data, convertRawToRequestTarget, sendRequestHandler);
    }
    return result;
  }

  function prepareToReceive(data, sendRequestHandler) {
    if (data) {
      data.value = convertFromRaw(data.value, sendRequestHandler);
    }
    return data;
  }

  return {
    prepareToSend: prepareToSend,
    prepareToReceive: prepareToReceive
  };
})();

function evaluateRequest(type, cmd, value, target) {
  var handler, result = undefined;
  switch (type) {
    case CommandType.CALL:
      with (target) {
        if (cmd) {
          eval('handler = ' + cmd);
          result = handler.apply(target, value);
        } else {
          //FIXME Find way to pass function context
          result = target.apply(null, value);
        }
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
