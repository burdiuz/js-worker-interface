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
        this._sendRequestHandler(pack, deferred);
        break;
    }
    return promise;
  }

  function _sendRequest(type, cmd, value) {
    var pack = _createRequestPackage(type, cmd, value, this.id);
    var promise = _applyRequest(pack, createDeferred());
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
    return {
      _targetLink_: {
        id: this.id,
        type: this.targetType,
        poolId: this.poolId
      }
    };
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
    var _link;
    var _temporary;
    var _hadChildPromises = false;
    var _status = TargetStatus.PENDING;
    var _queue = [];

    Object.defineProperties(this, {
      id: {
        get: function() {
          return _link ? _link.id : null;
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
          return _link ? _link.type : null;
        },
        configurable: true
      },
      poolId: {
        get: function() {
          return _link ? _link.poolId : null;
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
              this.destroy();
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
        value: this
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

    function _isTemporary() {
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
        _temporary = _isTemporary();
        if (_temporary) {
          _queue[_queue.length - 1][1].promise.then(_destroy, _destroy);
        }
        //INFO Sending "this" as result of promise resolve causes infinite loop of this.then(), so I've used wrapper object
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
        _this._sendRequestHandler(pack, deferred);
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
    return typeof(object) === 'object' && typeof(object._targetLink_) === 'object' && object._targetLink_;
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
