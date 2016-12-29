var gulp = require('gulp');
var runSequence = require('run-sequence');
var paths = require('../paths');

gulp.task('export', function(callback) {
  paths.setIsExport(true);
  return runSequence(
    ['build'],
    callback
  );
});
