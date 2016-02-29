// Uses Node, AMD or browser globals to create a module.
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['WorkerEventDispatcher'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require('WorkerEventDispatcher'));
  } else {
    // Browser globals (root is window)
    root.WorkerInterface = factory(root.WorkerEventDispatcher);
  }
}(this, function(WorkerEventDispatcher) {
  // here should be injected worker-interface.js content
  /**
   * Created by Oleg Galaburda on 25.02.16.
   */
  var WorkerInterface;
  function generateWorkerBlobData(importScriptURLs) {
    importScriptURLs = importScriptURLs instanceof Array ? importScriptURLs : [String(importScriptURLs)];
    var length = importScriptURLs.length;
    for (var index = 0; index < length; index++) {
      importScriptURLs[index] = WorkerInterface.fullImportScriptURL(importScriptURLs[index]);
    }
    return generateBlob([
      Scripts.DEPS_SRC,
      Scripts.INTERFACE_SRC,
      Scripts.SELF_SRC.replace('{$}', importScriptURLs.join('", "'))
    ], 'text/javascript;charset=UTF-8');
  }
  
  function generateBlob(data, type) {
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
  
  function isStandalone() {
    return typeof(Scripts) !== 'undefined' && Scripts.hasOwnProperty('SELF_SRC');
  };
  
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
      //'~WI:Request': true, // we need to receive already created wrapper object and resolved dependencies to execute commands
      '~WI:Response': true // here we receive only metadata because wrapper objects are already created with promises
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
      if (data.target instanceof RequestTarget) {
        data = data.target.toJSON();
      }else if (typeof(data.toJSON) === 'function') {
        data = data.toJSON();
      }
      return data;
    }
  
    function convertRawToRequestTarget(data, sendRequestHandler) {
      var poolId = RequestTargetLink.getLinkPoolId(data);
      if (poolId === TargetPool.instance.id) { // target object is stored in current pool
        data = TargetPool.instance.get(RequestTargetLink.getLinkId(data));
        if (data) {
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
      if (typeof(data) === 'object' && data !== null) {
        if (RequestTargetLink.isLink(data)) { // if data is link
          result = convertRawToRequestTarget(data, sendRequestHandler);
        } else if (data instanceof Array) { // if data is Array of values, check its
          result = convertArrayTo(data, convertRawToRequestTarget, sendRequestHandler);
        } else if (data.constructor === Object) {
          result = convertHashTo(data, convertRawToRequestTarget, sendRequestHandler);
        }
      }
      return result;
    }
  
    function prepareToReceive(data, sendRequestHandler) {
      if (data) {
        data.value = convertFromRaw(data.value, sendRequestHandler);
      }
      return data;
    }
  
    function isPending(value) {
      return value.target instanceof RequestTarget && value.target.status == TargetStatus.PENDING;
    }
  
    function lookupForPending(data) {
      var result = [];
      if (typeof(data) === 'object' && data !== null) {
        function add(value) {
          if (isPending(value)) {
            result.push(value);
          }
          return value;
        }
        if (isPending(data)) {
          result.push(data);
        } else if (data instanceof Array) {
          convertArrayTo(data, add);
        } else if (data.constructor === Object) {
          convertHashTo(data, add);
        }
      }
      return result;
    }
  
    return {
      prepareToSend: prepareToSend,
      prepareToReceive: prepareToReceive,
      lookupForPending: lookupForPending
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
  
  /**
   * Created by Oleg Galaburda on 25.02.16.
   */
  
  var TargetStatus = {
    PENDING: 'pending',
    RESOLVED: 'resolved',
    REJECTED: 'rejected',
    DESTROYED: 'destroyed'
  };
  //FIXME Make an internal class of objects that will hold all of internal functionality & data of the RequestTarget and will never be exposed to public
  // RequestTarget<>-------RequestTargetInternals
  // This will help by moving all of RequestTarget internal methods to RequestTargetInternals prototype
  // Also try to use Symbols for naming, might help with hiding private members
  var RequestTarget = (function() {
  
    function _createRequestPackage(type, cmd, value, targetId) {
      return pack = {
        type: type,
        cmd: cmd,
        value: value,
        target: targetId
      };
    }
  
    function _applyRequest(pack, deferred) {
      var promise = deferred.promise;
      switch (this.status) {
        case TargetStatus.PENDING:
          this._addToQueue(pack, deferred);
          break;
        case TargetStatus.REJECTED:
          promise = Promise.reject(new Error('Target object was rejected and cannot be used for calls.'));
          break;
        case TargetStatus.DESTROYED:
          promise = Promise.reject(new Error('Target object was destroyed and cannot be used for calls.'));
          break;
        case TargetStatus.RESOLVED:
          //this._sendRequestHandler(pack, deferred);
          this._sendRequestHandlerPrecondition(pack, deferred);
          break;
      }
      return promise;
    }
  
    function _sendRequestHandlerPrecondition(pack, deferred) {
      var list = DataConverter.lookupForPending(pack.value);
      if (list.length) {
        // FIXME Need to test on all platforms: In other browsers this might not work because may need list of Promise objects, not RequestTargets
        Promise.all(list).then(function() {
          this._sendRequestHandler(pack, deferred);
        }.bind(this));
      } else {
        this._sendRequestHandler(pack, deferred);
      }
    }
  
    function _sendRequest(type, cmd, value) {
      var pack = _createRequestPackage(type, cmd, value, this.id);
      var promise = this._applyRequest(pack, createDeferred());
      return new RequestTarget(promise, this._sendRequestHandler);
    }
  
    function _get(path) {
      return this._sendRequest(CommandType.GET, path);
    }
  
    function _set(path, value) {
      return this._sendRequest(CommandType.SET, path, value);
    }
  
    function _call(path, args) {
      if (!args) {
        args = [];
      } else if (!(args instanceof Array)) {
        args = [args];
      }
      return this._sendRequest(CommandType.CALL, path, args);
    }
  
    function _execute(command) {
      return this._sendRequest(CommandType.EXEC, command);
    }
  
    function _isActive() {
      return this.status === TargetStatus.PENDING || this.status === TargetStatus.RESOLVED;
    }
  
    function _canBeDestroyed() {
      return this.id && this.status === TargetStatus.RESOLVED;
    }
  
    function _toJSON() {
      var json = {
        _targetLink_: {
          id: this.target.id,
          type: this.target.targetType,
          poolId: this.target.poolId
        }
      };
      return json;
    }
  
    /**
     * The object that will be available on other side
     * IMPORTANT: Function target is temporary if queue contains single CALL command when target is resolved.
     * @param _promise
     * @param sendRequestHandler
     * @constructor
     */
    function RequestTarget(_promise, sendRequestHandler) {
      var _this = this;
      var _link = {};
      var _temporary;
      var _hadChildPromises = false;
      var _status = TargetStatus.PENDING;
      var _queue = [];
  
      Object.defineProperties(_this, {
        id: {
          get: function() {
            return _link.id;
          },
          configurable: true
        },
        target: {
          get: function() {
            return _this;
          }
        },
        targetType: {
          get: function() {
            return _link.type;
          },
          configurable: true
        },
        poolId: {
          get: function() {
            return _link.poolId;
          },
          configurable: true
        },
        temporary: {
          get: function() {
            return _temporary;
          },
          //INFO User can set permanent/temporary by hand
          set: function(value) {
            if (this.isActive()) {
              _temporary = Boolean(value);
              if (_status == TargetStatus.RESOLVED) {
                _destroy();
              }
            }
          }
        },
        status: {
          get: function() {
            return _status;
          },
          configurable: true
        },
        _sendRequestHandler: {
          value: sendRequestHandler,
          configurable: true
        },
        _targetLink_: {
          value: _this
        }
      });
  
      function _destroy() {
        var promise = null;
        if (_this.canBeDestroyed()) {
          _status = TargetStatus.DESTROYED;
          promise = _this._sendRequest(CommandType.DESTROY_TARGET);
        } else {
          promise = Promise.reject();
        }
        return promise;
      }
  
      function _isTemporary(value) {
        /* TODO this case for Proxies, may be check for proxies support? this will work only if Proxies are enabled.
         For functions, they are temporary only if they have only CALL command in queue and child promises never created -- this commonly means that this target was used for function call in proxy.
         For any non-function target object, it will be marked as temporary only if has single item in request queue and child promises never created.
         */
        var temp = _temporary;
        if (typeof(temp) !== 'boolean') {
          if (RequestTargetLink.getLinkTargetType(value) === 'function') {
            temp = _queue && _queue.length === 1 && _queue[0][0].type == CommandType.CALL && !_hadChildPromises;
          } else {
            temp = (_queue && _queue.length === 1 && !_hadChildPromises);
          }
        }
        return temp;
      }
  
      function _resolveHandler(value) {
        _status = TargetStatus.RESOLVED;
        if (RequestTargetLink.isLink(value)) {
          _link = RequestTargetLink.getLinkData(value);
          _temporary = _isTemporary(value);
          if (_temporary) {
            _queue[_queue.length - 1][1].promise.then(_destroy, _destroy);
          }
          //INFO Sending "this" as result of resolve() handler, causes infinite loop of this.then(), so I've used wrapper object
          value = {target: _this};
        }
        _sendQueue();
        return value;
      }
  
      function _sendQueue() {
        while (_queue && _queue.length) {
          var request = _queue.shift();
          var pack = request[0];
          var deferred = request[1];
          pack.target = _link.id;
          //_this._sendRequestHandler(pack, deferred);
          _this._sendRequestHandlerPrecondition(pack, deferred);
        }
        _queue = null;
      }
  
      function _rejectHandler(value) {
        _status = TargetStatus.REJECTED;
        while (_queue && _queue.length) {
          var request = _queue.shift();
          request[1].reject(new Error('Target of the call was rejected and callcannot be sent.'));
        }
        _queue = null;
        return value;
      }
  
      function _then(success, fail) {
        var child = _promise.then(success, fail);
        //var child = _promise.then.apply(_promise, arguments);
        if (child) {
          _hadChildPromises = true;
        }
        return child;
      }
  
      function _catch() {
        var child = _promise.catch.apply(_promise, arguments);
        if (child) {
          _hadChildPromises = true;
        }
        return child;
      }
  
      function _addToQueue(pack, deferred) {
        _queue.push([pack, deferred]);
      }
  
      _promise = _promise.then(_resolveHandler, _rejectHandler);
  
      this._addToQueue = _addToQueue;
      this.then = _then;
      this.catch = _catch;
      this.destroy = _destroy;
    }
  
    RequestTarget.prototype.get = _get;
    RequestTarget.prototype.set = _set;
    RequestTarget.prototype.call = _call;
    RequestTarget.prototype.execute = _execute;
    RequestTarget.prototype.canBeDestroyed = _canBeDestroyed;
    RequestTarget.prototype.isActive = _isActive;
    RequestTarget.prototype.toJSON = _toJSON;
    RequestTarget.prototype._sendRequest = _sendRequest;
    RequestTarget.prototype._applyRequest = _applyRequest;
    RequestTarget.prototype._sendRequestHandlerPrecondition = _sendRequestHandlerPrecondition;
  
    return RequestTarget;
  })();
  
  
  var RequestTargetLink = (function() {
    /**
     * The object that can be used to send Target to other side
     * @constructor
     */
    function RequestTargetLink(_pool, _target, _id) {
      var _active = true;
      Object.defineProperties(this, {
        poolId: {
          get: function() {
            return _pool ? _pool.id : null;
          }
        },
        target: {
          get: function() {
            return _target;
          }
        },
        id: {
          get: function() {
            return _id;
          }
        },
        _targetLink_: {
          value: this
        }
      });
      this.destroy = function() {
        if (!_active) return;
        _active = false;
        _id = null;
        _pool = null;
        _target = null;
        _pool.remove(_id);
      };
    }
  
    RequestTargetLink.prototype.toJSON = function() {
      return {
        _targetLink_: {
          id: this.id,
          type: typeof(this.target),
          poolId: this.poolId
        }
      };
    };
  
    RequestTargetLink.getLink = function(id) {
      return {
        _targetLink_: {
          id: id || 0,
          poolId: TargetPool.instance.id
        }
      };
    };
  
    RequestTargetLink.getLinkData = function(object) {
      var data;
      if (RequestTargetLink.isLink(object)) {
        data = object._targetLink_;
      }
      return data;
    };
  
    RequestTargetLink.getLinkId = function(object) {
      var id;
      if (RequestTargetLink.isLink(object)) {
        id = object._targetLink_.id;
      }
      return id;
    };
  
    RequestTargetLink.getLinkPoolId = function(object) {
      var poolId;
      if (RequestTargetLink.isLink(object)) {
        poolId = object._targetLink_.poolId;
      }
      return poolId;
    };
  
    RequestTargetLink.getLinkTargetType = function(object) {
      var type;
      if (RequestTargetLink.isLink(object)) {
        type = object._targetLink_.type;
      }
      return type;
    };
  
    RequestTargetLink.isLink = function(object) {
      return object && typeof(object._targetLink_) === 'object' && object._targetLink_;
    };
  
    return RequestTargetLink;
  })();
  
  // TargetPool must have globally available instance, so many WorkerInterface instances can use it. Might be helpful for SharedWorker serve\r.
  function TargetPool() {
    var _map = new Map();
    this.set = function(target) {
      var link = null;
      if (TargetPool.isValidTarget(target)) {
        if (_map.has(target)) {
          link = _map.get(target);
        } else {
          var id = getId();
          link = new RequestTargetLink(this, target, id);
          _map.set(id, link);
          _map.set(target, link);
        }
      }
      return link;
    };
  
    this.has = function(target) {
      return _map.has(target);
    };
  
    this.get = function(target) {
      return _map.get(target);
    };
  
    this.remove = function(target) {
      var link = _map.get(target);
      if (link) {
        _map.delete(link.id);
        _map.delete(link.target);
        link.destroy();
      }
    };
  
    this.clear = function() {
      var list = _map.keys();
      var length = list.length;
      for (var index = 0; index < length; index++) {
        var key = list[index];
        if (typeof(key) === 'string') {
          var link = _map.get(key);
          link.destroy();
        }
      }
      _map.clear();
    };
  
    Object.defineProperties(this, {
      id: {
        value: getId()
      }
    });
  }
  
  TargetPool.isValidTarget = (function() {
    var valid = {
      'object': true,
      'function': true
    };
    return function(target) {
      return target && valid[typeof(target)];
    };
  })();
  
  Object.defineProperties(TargetPool, {
    instance: {
      value: new TargetPool()
    }
  });
  
  //FIXME WorkerInterface success handler received its internal RequestTarget instance but should receive interface instance.
  function WorkerInterfaceBase(importScriptURL, type) {
    var _dispatcher = null;
    var _deferred = createDeferred();
    var _target = new RequestTarget(_deferred.promise, sendRequest);
    // Default target for requests
    var _pool = {};
    /*
     FIFO queue for requests that were made before interface become ready.
     */
    if (importScriptURL) {
      if (isStandalone()) {
        _dispatcher = WorkerEventDispatcher.create(generateWorkerBlobData(importScriptURL), type || WorkerInterface.DEDICATED, receiverEventPreprocessor, senderEventPreprocessor);
      } else {
        _dispatcher = WorkerEventDispatcher.create(importScriptURL, type || WorkerInterface.DEDICATED, receiverEventPreprocessor, senderEventPreprocessor);
      }
      _dispatcher.addEventListener(Events.READY_EVENT, readyEventHandler);
    } else {
      _dispatcher = WorkerEventDispatcher.self(receiverEventPreprocessor, senderEventPreprocessor);
      _dispatcher.dispatchEvent(Events.READY_EVENT);
      readyEventHandler();
    }
  
  
    var _requests = {};
  
    function readyEventHandler() {
      _dispatcher.removeEventListener(Events.READY_EVENT, readyEventHandler);
      _deferred.resolve(RequestTargetLink.getLink(''));
    }
  
    function requestEventHandler(event) {
      var result, target;
      var data = event.data;  // {type:string, id:string, cmd:string, value:any, target: string
      try {
        target = data.target ? TargetPool.instance.get(data.target) : _pool;
        // data.value should be preprocessed in evaluateRequest
        result = evaluateRequest(data.type, data.cmd, data.value, target);
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
  
    function receiverEventPreprocessor(event) {
      /* INFO Regenerate event since data might be read-only? Might be data loss in case of inocrrent cloning
       event.data = DataConverter.prepareToReceive(event.data);
       return event;
       */
      if (!Events.internals[event.type]) {
        event = {
          type: event.type,
          data: DataConverter.prepareToReceive(event.data, sendRequest)
        };
      }
      return event;
    }
  
    function senderEventPreprocessor(event) {
      /* INFO Regenerate event since data might be read-only? Might be data loss in case of inocrrent cloning
       event.data = DataConverter.prepareToSend(event.data);
       return event;
       */
      return {
        type: event.type,
        data: DataConverter.prepareToSend(event.data)
      };
    }
  
    function sendRequest(pack, deferred) {
      var id = getId();
      pack.id = id;
      pack.value = DataConverter.prepareToSend(pack.value);
      deferred = deferred || createDeferred(id);
      _requests[id] = deferred;
      _dispatcher.dispatchEvent(Events.REQUEST_EVENT, pack);
      return deferred.promise;
    }
  
    function sendResponse(data, type, id) {
      var result = {
        id: id,
        type: type,
        value: data
      };
      _dispatcher.dispatchEvent(Events.RESPONSE_EVENT, result);
    }
  
  
  // RequestTarget methods
    this.get = _target.get.bind(_target);
    this.set = _target.set.bind(_target);
    this.call = _target.call.bind(_target);
    this.execute = _target.execute.bind(_target);
    // RequestTarget Promise methods
    this.then = _target.then;
    this.catch = _target.catch;
  
    Object.defineProperties(this, {
      dispatcher: {
        value: _dispatcher
      },
      target: {
        value: this
      },
      pool: {
        get: function() {
          return _pool;
        },
        set: function(value) {
          _pool = value;
        }
      }
    });
  
    _dispatcher.addEventListener(Events.REQUEST_EVENT, requestEventHandler);
    _dispatcher.addEventListener(Events.RESPONSE_EVENT, responseEventHandler);
  }
  
  if (typeof(Proxy) === 'function') {
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
    
  }else{
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
    
  }
  function create(importScriptURLs) {
    return new WorkerInterface(importScriptURLs, WorkerInterface.DEDICATED);
  }
  
  WorkerInterface.create = create;
  WorkerInterface.isStandalone = isStandalone;
  WorkerInterface.generateBlob = generateBlob;
  WorkerInterface.fullImportScriptURL = fullImportScriptURL;
  WorkerInterface.DEDICATED = WorkerEventDispatcher.WorkerType.DEDICATED_WORKER;
  // Shared workers are not supported yet
  //WorkerInterface.SHARED = WorkerEventDispatcher.WorkerType.SHARED_WORKER;
  WorkerInterface.WorkerEventDispatcher = WorkerEventDispatcher;
  
  
  return WorkerInterface;
}));
