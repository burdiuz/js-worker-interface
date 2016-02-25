/**
 * Created by Oleg Galaburda on 25.02.16.
 */

//FIXME merge TargetPool and WorkerInterface common API
//FIXME replace interfaceReady/onInterfaceReady with .promise
function WorkerInterfaceBase(importScriptURL, type) {
  var _this = this;
  var _dispatcher = null;
  var _deferred = createDeferred();
  var _target = new RequestTarget(_deferred.promise, sendRequest);
  /*
   FIFO queue for requests that were made before interface become ready.
   */
  if (importScriptURL) {
    if (isStandalone()) {
      _dispatcher = WorkerEventDispatcher.create(generateWorkerBlobData(importScriptURL), type || WorkerInterface.DEDICATED);
    } else {
      _dispatcher = WorkerEventDispatcher.create(importScriptURL, type || WorkerInterface.DEDICATED);
    }
    _dispatcher.addEventListener(Events.READY_EVENT, readyEventHandler);
  } else {
    _dispatcher = WorkerEventDispatcher.self();
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
      target = data.target ? TargetPool.instance.get(data.target) : _this.pool;
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

  function sendRequest(pack, deferred) {
    var id = getId();
    pack.id = id;
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
  // EventDispatcher methods
  this.addEventListener = _dispatcher.addEventListener;
  this.hasEventListener = _dispatcher.hasEventListener;
  this.removeEventListener = _dispatcher.removeEventListener;
  this.removeAllEventListeners = _dispatcher.removeAllEventListeners;
  this.dispatchEvent = _dispatcher.dispatchEvent;
  // Default target for requests
  this.pool = {};

  Object.defineProperties(this, {
    dispatcher: {
      value: _dispatcher
    }
  });

  _dispatcher.addEventListener(Events.REQUEST_EVENT, requestEventHandler);
  _dispatcher.addEventListener(Events.RESPONSE_EVENT, responseEventHandler);
}

WorkerInterface.DEDICATED = WorkerEventDispatcher.WorkerType.DEDICATED_WORKER;
// Shared workers are not supported yet
//WorkerInterface.SHARED = WorkerEventDispatcher.WorkerType.SHARED_WORKER;
WorkerInterface.READY_EVENT = Events.READY_EVENT;
WorkerInterface.READY_HANDLER = 'onInterfaceReady';
WorkerInterface.WorkerEventDispatcher = WorkerEventDispatcher;
