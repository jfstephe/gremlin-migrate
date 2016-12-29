var gulp = require('gulp');
var paths = require('../paths');
var runSequence = require('run-sequence');

// outputs changes to files to the console
function reportChange(event) {
  console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
}

gulp.task('watch', function(callback) {
  return runSequence(
    ['build'],
    ['test'],
    function() {
      gulp.watch(paths.getSourceTs(), ['build-unclean']).on('change', reportChange);
      gulp.watch(paths.getOutputJs(), ['test']).on('change', reportChange);
      callback();
    });
  }
);