/**
 * Created by Oleg Galaburda on 25.02.16.
 */

/**
 * The object that will be available on other side
 * @param _name
 * @param _dispatcher
 * @constructor
 */
function TargetMirror(_name, _dispatcher) {
  Object.define
  name
}

/**
 * The object that can be used to send Target to other side
 * @param _host
 * @param _name
 * @constructor
 */
function TargetLink(_owner, _host, _name) {
  Object.defineProperties(this, {
    owner: {
      value: _owner
    },
    host: {
      value: _host
    },
    name: {
      value: _name
    },
    type: {
      value: typeof _host
    }
  });
  this.toJSON = function() {
    return {
      _targetLink_: {
        name: this.name
      }
    };
  };
}
TargetLink.isLink = function(object) {
  return object instanceof TargetLink || (object instanceof Object && object.hasOwnProperty('_targetLink_'));
}

function TargetPool(_owner) {
  var _hosts = new Map();
  var _links = new Map();
  this.add = function(target, name) {
    var id = String(name) || getId();
    if (_map.has(id)) {
      throw new Error('Target with name "' + name + '" already exists.');
    }
    /*
     if (_map.has(target)) {
     throw new Error('Target already registered.');
     }
     */
    var link = new TargetLink(_owner, target, id);
    //FIXME Add to EventDispatcher ability to pre-process every event that is going to be dispatched
    _owner.dispatcher.dispatchEvent(Events.TARGET_REGISTERED, link.toJSON());
    _map.set(id, target);
    _map.set(target, id);
    _links.set(target, link);
    return link;
  }
}
