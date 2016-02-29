/**
 * Created by Oleg Galaburda on 10.02.16.
 */
importScripts(
  '../../bower_components/event-dispatcher/dist/event-dispatcher.js',
  '../../bower_components/messageport-dispatcher/dist/messageport-dispatcher.js',
  '../../bower_components/worker-event-dispatcher/dist/worker-event-dispatcher.js',

  '../../source/interface/utils.js',
  '../../source/interface/core.js',
  '../../source/interface/target-pool.js',
  '../../source/interface/base-interface.js',
  //'../../source/interface/worker-interface.js',
  '../../source/interface/proxy.js',
  '../../source/interface/shared-api.js'
);
var api = WorkerInterface.self = new WorkerInterface();
// -------------- self

api.pool = {
  requestTime: function() {
    return Date.now();
  },
  callHandler: function(handler) {
    return handler();
  }
};

console.log('Worker script was imported.');
