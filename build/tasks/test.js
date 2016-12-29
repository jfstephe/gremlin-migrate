const gulp = require('gulp');
const jasmine = require('gulp-jasmine');
var paths = require('../paths');
var cucumber = require('gulp-cucumber');
var runSequence = require('run-sequence');
const reporters = require('jasmine-reporters');

gulp.task('specs', () => {
    return gulp.src(paths.getSpecFiles(), { base: '.' })
        .pipe(jasmine({
            reporter: [new reporters.JUnitXmlReporter({savePath: __dirname + '/../../test/results/'}), new reporters.TerminalReporter()],
            verbose: true,
            includeStackTrace: true
        }))
});


gulp.task('test', function(callback) {
    return runSequence(
        'specs',
        callback
    );
});