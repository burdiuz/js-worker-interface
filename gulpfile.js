/**
 * Created by Oleg Galaburda on 26.12.15.
 */
var fs = require('fs');
var gulp = require('gulp');
var uglify = require('gulp-uglify');
var stringInject = require('gulp-string-inject');
var rename = require('gulp-rename');
var include = require('gulp-include');

//FIXME make it asynchronous, because files are not created when 'build' task requests them

gulp.task('compile', function(callback) {
  gulp.src('source/worker-interface.js')
    // create concatenated file
    .pipe(include())
    .pipe(rename('worker-interface.temp.js'))
    .pipe(gulp.dest('.'))
    .on('finish', function() {
      console.log('compile done!');
      callback();
    });
});
gulp.task('prepare-master', ['compile'], function(callback) {
  gulp.src('source/worker-master.js')
    // create concatenated file
    .pipe(stringInject(stringInject.UGLIFY))
    .pipe(rename('worker-master.temp.js'))
    .pipe(gulp.dest('.'))
    .on('finish', function() {
      console.log('prepare-master done!');
      callback();
    });
});
gulp.task('clear-temp', ['build'], function() {
  fs.unlink('./worker-interface.temp.js');
  fs.unlink('./worker-master.temp.js');
});
gulp.task('build', ['prepare-master'], function(callback) {
  gulp.src('source/worker-interface-umd.js')
    // create concatenated file
    .pipe(include())
    .pipe(rename('worker-interface.js'))
    .pipe(gulp.dest('dist'))
    // create minified version
    .pipe(uglify())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest('dist'))
    .on('finish', function() {
      console.log('build done!');
      callback();
    });
});

gulp.task('default', ['compile', 'prepare-master', 'build', 'clear-temp']);
