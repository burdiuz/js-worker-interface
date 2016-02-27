/**
 * Created by Oleg Galaburda on 25.02.16.
 */


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
    console.log(' - requestEventHandler', event);
    var result, target;
    var data = event.data;  // {type:string, id:string, cmd:string, value:any, target: string
//    try {
    target = data.target ? TargetPool.instance.get(data.target) : _pool;
    // data.value should be preprocessed in evaluateRequest
    result = evaluateRequest(data.type, data.cmd, data.value, target);
    /*    } catch (error) {
     sendResponse({
     name: error.name,
     message: error.message
     }, ResponseTypes.RESULT_FAILURE, data.id);
     throw error;
     }
     */
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
    console.log(' - responseEventHandler', event);
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
    console.log(' -- receiverEventPreprocessor', event);
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
    console.log(' -- senderEventPreprocessor', event);
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
