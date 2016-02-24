/**
 * Created by Oleg Galaburda on 19.02.16.
 */
var api = WorkerInterface.self = new WorkerInterface();
try {
  importScripts("{$}");
} catch (error) {
  console.log(error.name, error.message);
  console.log(error);
}
