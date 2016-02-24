/**
 * Created by Oleg Galaburda on 10.02.16.
 */
importScripts(
  '../bower_components/event-dispatcher/dist/event-dispatcher.js',
  '../bower_components/messageport-dispatcher/dist/messageport-dispatcher.js',
  '../bower_components/worker-event-dispatcher/dist/worker-event-dispatcher.js',
  '../source/worker-interface.js'
);
var api = WorkerInterface.self = new WorkerInterface();
// -------------- self
/*
 var api = WorkerEventDispatcher.self();
 api.addEventListener('time:request', function() {
 setTimeout(function() {
 api.dispatchEvent('time:response', Date.now());
 }, 200);
 });
 */
api.pool.requestTime = function() {
  return Date.now();
};
console.log('Worker script was imported.', api);
