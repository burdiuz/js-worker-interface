/**
 * Created by Oleg Galaburda on 24.02.16.
 */

var EventDispatcher = (function() {
  //=include ../node_modules/event-dispatcher/source/event-dispatcher.js
  return EventDispatcher;
})();
var MessagePortDispatcher = (function() {
  //=include ../node_modules/messageport-dispatcher/source/messageport-dispatcher.js
  return MessagePortDispatcher;
})();
var WorkerEventDispatcher = (function() {
  //=include ../node_modules/worker-event-dispatcher/source/worker-event-dispatcher.js
  return WorkerEventDispatcher;
})();
