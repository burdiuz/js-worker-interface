/**
 * Created by Oleg Galaburda on 26.12.15.
 */
var fs = require('fs');
var gulp = require('gulp');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var include = require('gulp-include');
var stringInject = require('gulp-string-inject');

// --------- Build Normal
gulp.task('normal-compile', function(callback) {
  gulp.src('source/master.js')
    .pipe(include())
    .pipe(rename('worker-interface.temp.js'))
    .pipe(gulp.dest('.'))
    .on('finish', function() {
      callback();
    });

});
gulp.task('normal-build', ['normal-compile'], function(callback) {
  gulp.src('source/worker-interface-umd.js')
    .pipe(include())
    .pipe(rename('worker-interface.js'))
    .pipe(gulp.dest('./dist'))
// --------- Build Normal Min
    .pipe(uglify())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest('dist'))
    .on('finish', function() {
      callback();
    });
});
// --------- Build Standalone
gulp.task('standalone-dependencies', function(callback) {
  gulp.src('source/standalone/dependencies.js')
    // create concatenated file
    .pipe(include())
    .pipe(rename('dependencies.temp.js'))
    .pipe(gulp.dest('.'))
    .on('finish', function() {
      callback();
    });
});
gulp.task('standalone-compile', ['standalone-dependencies', 'normal-compile'], function(callback) {
  gulp.src('source/standalone/master.js')
    .pipe(stringInject())
    .pipe(include())
    .pipe(rename('standalone-master.temp.js'))
    .pipe(gulp.dest('.'))
    .on('finish', function() {
      callback();
    });
});
gulp.task('standalone-build', ['standalone-compile'], function(callback) {
  gulp.src('source/standalone/worker-interface-umd.js')
    // create concatenated file
    .pipe(rename('worker-interface.standalone.js'))
    .pipe(include())
    .pipe(gulp.dest('./dist'))
    .on('finish', function() {
      callback();
    });
});
// --------- Build Standalone Min
gulp.task('standalone-compile-min', ['standalone-dependencies', 'normal-compile'], function(callback) {
  gulp.src('source/standalone/master.js')
    .pipe(stringInject(stringInject.UGLIFY))
    .pipe(include())
    .pipe(rename('standalone-master.temp.js'))
    .pipe(gulp.dest('.'))
    .on('finish', function() {
      callback();
    });
});
gulp.task('standalone-build-min', ['standalone-compile-min'], function(callback) {
  gulp.src('source/standalone/worker-interface-umd.js')
    // create concatenated file
    .pipe(include())
    .pipe(uglify())
    .pipe(rename('worker-interface.standalone.min.js'))
    .pipe(gulp.dest('./dist'))
    .on('finish', function() {
      callback();
    });
});
// ---------
gulp.task('clear-temp', ['normal-build', 'standalone-build', 'standalone-compile-min'], function() {
  var list = [
    './standalone-master.temp.js',
    './worker-interface.temp.js',
    './dependencies.temp.js'
  ];
  list.forEach(function(item) {
    if (fs.existsSync(item)) {
      fs.unlink(item);
    }
  });
});

gulp.task('default', ['clear-temp']);
