/**
 * Created by Oleg Galaburda on 10.02.16.
 */
importScripts(
  '../bower_components/event-dispatcher/dist/event-dispatcher.js',
  '../bower_components/messageport-dispatcher/dist/messageport-dispatcher.js',
  '../bower_components/worker-event-dispatcher/dist/worker-event-dispatcher.js',

  '../dist/worker-interface.js'
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
