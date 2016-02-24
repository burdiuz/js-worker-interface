/**
 * Created by Oleg Galaburda on 19.02.16.
 */

var EventDispatcher = (function() {
  //=include ../bower_components/event-dispatcher/source/event-dispatcher.js
  return EventDispatcher;
})();
var MessagePortDispatcher = (function() {
  //=include ../bower_components/messageport-dispatcher/source/messageport-dispatcher.js
  return MessagePortDispatcher;
})();
var WorkerEventDispatcher = (function() {
  //=include ../bower_components/worker-event-dispatcher/source/worker-event-dispatcher.js
  return WorkerEventDispatcher;
})();

function generateWorkerBlobData(importScriptURLs) {
  importScriptURLs = importScriptURLs instanceof Array ? importScriptURLs : [String(importScriptURLs)];
  var length = importScriptURLs.length;
  for (var index = 0; index < length; index++) {
    importScriptURLs[index] = WorkerInterface.fullImportScriptURL(importScriptURLs[index]);
  }
  return createBlob([
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
    return _base + String(++_index);
  };
})();

function isStandalone() {
  return Scripts && Scripts.hasOwnProperty('SELF_SRC');
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
  REQUEST_EVENT: '~WI:Request',
  RESPONSE_EVENT: '~WI:Response'
};

var ResponseTypes = {
  RESULT_SUCCESS: 'success',
  RESULT_FAILURE: 'failure'
};

function execute(type, cmd, value, target) {
  var handler, result = undefined;
  switch (data.type) {
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
  return {type: ResponseTypes.RESULT_SUCCESS, value: result};
}

function WorkerInterface(importScriptURLs, type) {
  var _dispatcher = null;
  if (importScriptURLs) {
    if (isStandalone()) {
      _dispatcher = WorkerEventDispatcher.create(generateWorkerBlobData(importScriptURLs), type || WorkerInterface.DEDICATED);
    } else {
      _dispatcher = WorkerEventDispatcher.create(importScriptURLs, type || WorkerInterface.DEDICATED);
    }
  } else {
    _dispatcher = WorkerEventDispatcher.self();
  }

  var _requests = {};

  _dispatcher.addEventListener(Events.REQUEST_EVENT, function(event) {
    var result;
    var data = event.data;  // {type:string, id:string, cmd:string, value:any}
    try {
      result = execute(data.type, data.cmd, data.value, this.pool);
    } catch (error) {
      _dispatcher.dispatchEvent(Events.RESPONSE_EVENT, {
        id: data.id,
        type: ResponseTypes.RESULT_FAILURE,
        value: {
          name: error.name,
          message: error.message
        }
      });
      throw error;
    }
    result.id = data.id;
    _dispatcher.dispatchEvent(Events.RESPONSE_EVENT, result);
  }.bind(this));

  _dispatcher.addEventListener(Events.RESPONSE_EVENT, function(event) {
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
  });

  function sendCommand(type, cmd, value) {
    var id = getId();
    var pack = {
      type: type,
      id: id,
      cmd: cmd,
      value: value
    };
    var deferred = createDeferred(id);
    _requests[id] = deferred;
    _dispatcher.dispatchEvent(WorkerInterface.REQUEST_EVENT, pack);
    return deferred.promise;
  }

  function get(path) {
    return sendCommand(CommandType.GET, path);
  }

  function set(path, value) {
    return sendCommand(CommandType.SET, path, value);
  }

  function call(path, args) {
    if (!args) {
      args = [];
    } else if (!(args instanceof Array)) {
      args = [args];
    }
    return sendCommand(CommandType.CALL, path, args);
  }

  function execute(command) {
    return sendCommand(CommandType.EXEC, command);
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
}

WorkerInterface.fullImportScriptURL = fullImportScriptURL;
WorkerInterface.fullImportScriptURL = fullImportScriptURL;
WorkerInterface.DEDICATED = WorkerEventDispatcher.WorkerType.DEDICATED_WORKER;
WorkerInterface.SHARED = WorkerEventDispatcher.WorkerType.SHARED_WORKER;
WorkerInterface.EventDispatcher = EventDispatcher;
WorkerInterface.MessagePortDispatcher = MessagePortDispatcher;
WorkerInterface.WorkerEventDispatcher = WorkerEventDispatcher;
