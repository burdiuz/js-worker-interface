/**
 * Created by Oleg Galaburda on 25.02.16.
 */

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

var getId = (function() {
  var _base = 'WI/';
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

function create(importScriptURLs) {
  return new WorkerInterface(importScriptURLs, WorkerInterface.DEDICATED);
}

WorkerInterface.create = create;
WorkerInterface.isStandalone = isStandalone;
WorkerInterface.generateBlob = generateBlob;
WorkerInterface.fullImportScriptURL = fullImportScriptURL;
