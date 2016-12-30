var gulp = require('gulp');
var paths = require('../paths');
var tslint = require('tslint');
var gulpTslint = require('gulp-tslint');
var debug = require('gulp-debug');

gulp.task('lint', function() {
  var program = tslint.Linter.createProgram("./tsconfig.json");

  return gulp.src(paths.getSourceAppOnlyTs(), { base: '.' })
  .pipe(debug())
    .pipe(gulpTslint({
        program: program,
        configuration: "./build/tslint.json"
    }))
    .pipe(gulpTslint.report({
        summarizeFailureOutput: true
    }))
});