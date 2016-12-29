var gulp = require('gulp');
var paths = require('../paths');
var tslint = require('tslint');
var gulpTslint = require('gulp-tslint');
gulp.task('lint', function() {
  var program = tslint.createProgram("./tsconfig.json");

  return gulp.src(paths.getSourceAppOnlyTs(), { base: '.' })
    .pipe(gulpTslint({
        program: program,
        configuration: "./build/tslint.json"
    }))
    .pipe(gulpTslint.report({
        summarizeFailureOutput: true
    }))
});