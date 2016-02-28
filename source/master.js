/**
 * Created by Oleg Galaburda on 25.02.16.
 */
var WorkerInterface;
//=include interface/utils.js
//=include interface/core.js
//=include interface/target-pool.js
//=include interface/base-interface.js
if (typeof(Proxy) === 'function') {
  //=include interface/proxy.js
}else{
  //=include interface/worker-interface.js
}
//=include interface/shared-api.js
