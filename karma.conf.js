// Karma configuration
// Generated on Sun Mar 01 2015 00:02:01 GMT-0500 (Eastern Standard Time)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'sinon-chai'],


    // list of files / patterns to load in the browser
    /*FIXME Create separate config file for Proxies test and add script to travis-ci, how to merge coverage reports?
    Look if possible to run one carma instance for different configs
    */
    files: [
      'node_modules/event-dispatcher/dist/event-dispatcher.js',
      'node_modules/messageport-dispatcher/dist/messageport-dispatcher.js',
      'node_modules/worker-event-dispatcher/dist/worker-event-dispatcher.js',
      'source/interface/utils.js',
      'source/interface/core.js',
      'source/interface/target-pool.js',
      'source/interface/base-interface.js',
      'source/interface/worker-interface.js',
      'tests/stubs.js',
      'tests/*.spec.js'
    ],


    // list of files to exclude
    exclude: [],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'source/*.js': ['coverage']
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['coverage', 'progress', 'coveralls'],


    // optionally, configure the reporter
    coverageReporter: {
      type: 'lcov',
      dir: 'coverage/'
    },


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Firefox'],
    //browsers: ['Chrome', 'IE', 'Firefox'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true
  });
};
