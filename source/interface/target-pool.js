/**
 * Created by Oleg Galaburda on 25.02.16.
 */

var TargetStatus = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  REJECTED: 'rejected'
};

//FIXME Instances of this object must be returned from WorkerInterface.get() all the time
//FIXME provide way to return RequestTarget back to worker, it should transform to original value when received
var RequestTarget = (function() {
  function _sendQueue() {
    while (this._queue && this._queue.length) {
      var request = this._queue.shift();
      this._sendRequestHandler(request[0], request[1]);
    }
    this._queue = null;
  }

  function _sendRequest(type, cmd, value) {
    var pack = {
      type: type,
      cmd: cmd,
      value: value,
      target: this._id
    };
    var deferred = createDeferred();
    switch (this._status) {
      case TargetStatus.PENDING:
        this._queue.push([pack, deferred]);
        break;
      case TargetStatus.REJECTED:
        Promise.reject(new Error('Target object was rejected and cannot be used for calls.'));
        break;
      case TargetStatus.RESOLVED:
        this._sendRequestHandler(pack, deferred);
        break;
    }
    return new RequestTarget(deferred.promise, this._sendRequestHandler);
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

  function _canBeDestroyed() {
    return this._id && this._status === TargetStatus.RESOLVED;
  }

  function _destroy() {
    return this.canBeDestroyed() ? this._sendRequest(CommandType.DESTROY_TARGET) : Promise.reject();
  }


  function resolveHandler(value) {
    this._status = TargetStatus.RESOLVED;
    if (RequestTargetLink.isLink(value)) {
      Object.defineProperties(this, {
        _id: {
          value: RequestTargetLink.getLinkId(value)
        }
      });
      value = this;
    }
    this._sendQueue();
    return value;
  }

  function rejectHandler(value) {
    this._status = TargetStatus.REJECTED;
    this._queue = null;
    return value;
  }

  /**
   * The object that will be available on other side
   * @param _promise
   * @param sendRequestHandler
   * @constructor
   */
  function RequestTarget(_promise, sendRequestHandler) {
    //TODO Might be better to hide _queue and _status under get/set
    Object.defineProperties(this, {
      _queue: {
        value: [],
        writable: true
      },
      _status: {
        value: TargetStatus.PENDING,
        writable: true
      },
      _sendRequestHandler: {
        value: sendRequestHandler
      }
    });

    _promise = _promise.then(
      resolveHandler.bind(this),
      rejectHandler.bind(this)
    );

    this.then = _promise.then;
    this.catch = _promise.catch;
  }

  RequestTarget.prototype.get = _get;
  RequestTarget.prototype.set = _set;
  RequestTarget.prototype.call = _call;
  RequestTarget.prototype.execute = _execute;
  RequestTarget.prototype.canBeDestroyed = _canBeDestroyed;
  RequestTarget.prototype.destroy = _destroy;

  Object.defineProperties(RequestTarget.prototype, {
    _sendQueue: {
      value: _sendQueue
    },
    _sendRequest: {
      value: _sendRequest
    }
  });

  return RequestTarget;
})();


var RequestTargetLink = (function() {
  /**
   * The object that can be used to send Target to other side
   * @param _host
   * @param _name
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
      if(!_active) return;
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

  RequestTargetLink.getLinkId = function(object) {
    var id;
    if (typeof(object) === 'object' && object.hasOwnProperty('_targetLink_')) {
      id = object._targetLink_.id;
    }
    return id;
  };

  RequestTargetLink.getLinkPoolId = function(object) {
    var poolId;
    if (typeof(object) === 'object' && object.hasOwnProperty('_targetLink_')) {
      poolId = object._targetLink_.poolId;
    }
    return poolId;
  };

  RequestTargetLink.isLink = function(object) {
    return typeof(object) === 'object' && object.hasOwnProperty('_targetLink_');
  };

  return RequestTargetLink;
})();

// TargetPool must have globally available instance, so many WorkerInterface instances can use it. Might be helpful for SharedWorker serve\r.
//FIXME Find a way how to make temporary linkage for immediately called functions
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

TargetPool.isValidTarget = function(target) {
  return target && typeof(target) === 'object';
};

Object.defineProperties(TargetPool, {
  instance: {
    value: new TargetPool()
  }
});
