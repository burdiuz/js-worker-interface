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
  //=include ../worker-interface.temp.js
  return WorkerInterface;
}));
