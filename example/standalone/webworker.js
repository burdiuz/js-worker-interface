/**
 * Created by Oleg Galaburda on 28.02.16.
 */
api.pool = {
  requestTime: function() {
    return Date.now();
  },
  callHandler: function(handler) {
    return handler();
  }
};
console.log('Worker script was imported.');
