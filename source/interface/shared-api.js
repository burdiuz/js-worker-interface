/**
 * Created by Oleg Galaburda on 26.02.16.
 */

WorkerInterface.create = create;
WorkerInterface.isStandalone = isStandalone;
WorkerInterface.generateBlob = generateBlob;
WorkerInterface.fullImportScriptURL = fullImportScriptURL;
WorkerInterface.DEDICATED = WorkerEventDispatcher.WorkerType.DEDICATED_WORKER;
// Shared workers are not supported yet
//WorkerInterface.SHARED = WorkerEventDispatcher.WorkerType.SHARED_WORKER;
WorkerInterface.WorkerEventDispatcher = WorkerEventDispatcher;
