# WorkerInterface
[![Coverage Status](https://coveralls.io/repos/github/burdiuz/js-worker-interface/badge.svg?branch=master)](https://coveralls.io/github/burdiuz/js-worker-interface?branch=master)
[![Build Status](https://travis-ci.org/burdiuz/js-worker-interface.svg?branch=master)](https://travis-ci.org/burdiuz/js-worker-interface)  
  
> This project is currently under heavy development. So documentation will come a bit later(after tests are done, check the badge above).

Interface wrapper for Web Workers, allows requesting properties and calling methods from Worker and receive result in a promise.
```javascript
      var api = new WorkerInterface('webworker.js');

      console.log('Interface created');
      api.get('callHandler').call(null, api.get('requestTime')).then(function(data) {
        console.log('setHandler called', arguments);
      });
      api.then(function(obj) {
        console.log('Interface ready!', obj);
        api.get('requestTime').call().then(function(data) {
          console.log('requestTime resolved', arguments);
        });
      });
```
To work properly WorkerInterface should be loaded into client and Worker
```javascript
importScripts(
  '../bower_components/event-dispatcher/dist/event-dispatcher.js',
  '../bower_components/messageport-dispatcher/dist/messageport-dispatcher.js',
  '../bower_components/worker-event-dispatcher/dist/worker-event-dispatcher.js',

  '../dist/worker-interface.js'
);
var api = WorkerInterface.self = new WorkerInterface();

api.pool = {
  requestTime: function() {
    return Date.now();
  },
  callHandler: function(handler) {
    return handler();
  }
};

console.log('Worker script was imported.');
```


Harmony Proxies work in Firefox and Google Chrome Canary.
```javascript
      var api = new WorkerInterface('../webworker.js');
      
      console.log('Interface created');
      api.callHandler(api.requestTime).then(function() {
        console.log('setHandler called', arguments);
      });
      api.then(function(obj) {
        console.log('Interface ready!');
        api.requestTime().then(function() {
          console.log('requestTime called', arguments);
        });
      });
```

Has standalone version that injects own code into worker and then executes `importScript()`, so there are no need to load WorkerInterface code manually.
Worker code from above, when using standalone will look like: 
```javascript
api.pool = {
  requestTime: function() {
    return Date.now();
  },
  callHandler: function(handler) {
    return handler();
  }
};
console.log('Worker script was imported.');
```

Project contains examples in `examples` folder. To use them launch `node server` and go to 
```
http://localhost:8081/example/index.html
http://localhost:8081/example/proxies/index.html
http://localhost:8081/example/standalone/index.html
```

### Links
[https://www.w3.org/TR/workers/](https://www.w3.org/TR/workers/)
