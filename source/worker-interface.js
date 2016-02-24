/**
 * Created by Oleg Galaburda on 19.02.16.
 */

function generateWorkerBlobData(importScriptURLs) {
  importScriptURLs = importScriptURLs instanceof Array ? importScriptURLs : [String(importScriptURLs)];
  var length = importScriptURLs.length;
  for (var index = 0; index < length; index++) {
    importScriptURLs[index] = WorkerInterface.fullImportScriptURL(importScriptURLs[index]);
  }
  return createBlob([
    Scripts.DEPS_SRC,
    Scripts.INTERFACE_SRC,
    Scripts.SELF_SRC.replace('{$}', importScriptURLs.join('", "'))
  ], 'text/javascript;charset=UTF-8');
}

function createBlob(data, type) {
  var blob = new Blob(data instanceof Array ? data : [data], {type: type || 'text/plain;charset=UTF-8'});
  return window.URL.createObjectURL(blob);
}

function fullImportScriptURL(path) {
  if (path.search(/^\w+\:\/\//) >= 0) return path;
  var fullPath = window.location.origin;
  var dirs = window.location.pathname.match(/([^\/\\]+)(?:\/|\\)+/g);
  if (path.charAt() === '/') {
    fullPath += path;
  } else if (path.substr(0, 3) === '../') {
    var pathDirs = path.match(/([^\/\\]+)(?:\/|\\)+/g);
    while (pathDirs.length && dirs.length && pathDirs[0] === '../') {
      pathDirs.shift();
      dirs.pop();
    }
    fullPath += '/' + dirs.join('') + pathDirs.join('') + path.match(/[^\/\\]*$/g)[0];
  } else if (path.substr(0, 2) === './') {
    fullPath += '/' + dirs.join('') + path.substring(2);
  } else {
    fullPath += '/' + dirs.join('') + path;
  }
  return fullPath;
}

var getId = (function() {
  var _base = 'CMD/';
  var _index = 0;
  return function() {
    return _base + String(++_index) + '/' + String(Date.now());
  };
})();

function isStandalone() {
  return typeof Scripts !== 'undefined' && Scripts.hasOwnProperty('SELF_SRC');
};

function createDeferred(id) {
  var resolve, reject;
  var promise = new Promise(function(res, rej) {
    resolve = res;
    reject = rej;
  });
  return {
    id: id,
    resolve: resolve,
    reject: reject,
    promise: promise
  };
}

var CommandType = {
  GET: 'get',
  SET: 'set',
  CALL: 'call',
  EXEC: 'exec'
};

var Events = {
  READY_EVENT: 'interfaceReady',
  REQUEST_EVENT: '~WI:Request',
  RESPONSE_EVENT: '~WI:Response'
};

var ResponseTypes = {
  RESULT_SUCCESS: 'success',
  RESULT_FAILURE: 'failure'
};

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
        eval('result = ' + cmd);
      }
      break;
    case CommandType.GET:
      with (target) {
        eval('result = ' + cmd);
      }
      break;
    case CommandType.SET:
      handler = new Function('value,target', 'with(target){ ' + cmd + ' = value; }');
      handler(value, target);
      break;
  }
  return result;
}

function WorkerInterface(importScriptURLs, type) {
  var _this = this;
  var _dispatcher = null;
  var _scopeApi = false;
  var _ready = false;
  if (importScriptURLs) {
    if (isStandalone()) {
      _dispatcher = WorkerEventDispatcher.create(generateWorkerBlobData(importScriptURLs), type || WorkerInterface.DEDICATED);
    } else {
      _dispatcher = WorkerEventDispatcher.create(importScriptURLs, type || WorkerInterface.DEDICATED);
    }
  } else {
    _dispatcher = WorkerEventDispatcher.self();
    _scopeApi = true;
    _ready = true;
    _dispatcher.dispatchEvent(Events.READY_EVENT);
  }

  var _requests = {};

  function readyEventHandler() {
    _ready = true;
    if (_this.pool && typeof(_this.pool[WorkerInterface.READY_HANDLER]) === 'function') {
      _this.pool[WorkerInterface.READY_HANDLER].call(_this.pool);
    }
  }

  function requestEventHandler(event) {
    console.log('REquest received', event);
    var result;
    var data = event.data;  // {type:string, id:string, cmd:string, value:any}
    try {
      result = evaluateRequest(data.type, data.cmd, data.value, _this.pool);
    } catch (error) {
      sendResponse({
        name: error.name,
        message: error.message
      }, ResponseTypes.RESULT_FAILURE, data.id);
      throw error;
    }
    if (result instanceof Promise) {
      handlePromiseResponse(result, data.id);
    } else {
      sendResponse(result, ResponseTypes.RESULT_SUCCESS, data.id);
    }
  }

  function responseEventHandler(event) {
    var data = event.data; // {type:string, id:string, value:any}
    var deferred = _requests[data.id];
    delete _requests[data.id];
    switch (data.type) {
      default:
        throw new Error('Unknown package received:' + JSON.stringify(event));
        break;
      case ResponseTypes.RESULT_FAILURE:
        deferred.reject(data.value);
        break;
      case ResponseTypes.RESULT_SUCCESS:
        deferred.resolve(data.value);
        break;
    }
  }

  function sendRequest(type, cmd, value) {
    var id = getId();
    var pack = {
      type: type,
      id: id,
      cmd: cmd,
      value: value
    };
    var deferred = createDeferred(id);
    _requests[id] = deferred;
    _dispatcher.dispatchEvent(Events.REQUEST_EVENT, pack);
    return deferred.promise;
  }

  function handlePromiseResponse(promise, id) {
    promise.then(
      function(result) {
        sendResponse(result, ResponseTypes.RESULT_SUCCESS, id);
      },
      function(result) {
        sendResponse(result, ResponseTypes.RESULT_FAILURE, id);
      }
    );
  }

  function sendResponse(data, type, id) {
    var result = {
      id: id,
      type: type,
      value: data
    };
    _dispatcher.dispatchEvent(Events.RESPONSE_EVENT, result);
  }

  function get(path) {
    return sendRequest(CommandType.GET, path);
  }

  function set(path, value) {
    return sendRequest(CommandType.SET, path, value);
  }

  function call(path, args) {
    if (!args) {
      args = [];
    } else if (!(args instanceof Array)) {
      args = [args];
    }
    return sendRequest(CommandType.CALL, path, args);
  }

  function execute(command) {
    return sendRequest(CommandType.EXEC, command);
  }

  this.get = get;
  this.set = set;
  this.call = call;
  this.execute = execute;
  this.pool = {};

  Object.defineProperties(this, {
    dispatcher: {
      value: _dispatcher,
      configurable: false,
      writable: false
    }
  });

  if (!_scopeApi) {
    _dispatcher.addEventListener(Events.READY_EVENT, readyEventHandler);
  }
  _dispatcher.addEventListener(Events.REQUEST_EVENT, requestEventHandler);
  _dispatcher.addEventListener(Events.RESPONSE_EVENT, responseEventHandler);
}

WorkerInterface.isStandalone = isStandalone;
WorkerInterface.createBlob = createBlob;
WorkerInterface.fullImportScriptURL = fullImportScriptURL;
WorkerInterface.DEDICATED = WorkerEventDispatcher.WorkerType.DEDICATED_WORKER;
WorkerInterface.SHARED = WorkerEventDispatcher.WorkerType.SHARED_WORKER;
WorkerInterface.READY_EVENT = Events.READY_EVENT;
WorkerInterface.READY_HANDLER = 'onInterfaceReady';
//WorkerInterface.EventDispatcher = EventDispatcher;
//WorkerInterface.MessagePortDispatcher = MessagePortDispatcher;
WorkerInterface.WorkerEventDispatcher = WorkerEventDispatcher;
