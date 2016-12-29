var gulp = require('gulp');
var bump = require('gulp-bump');
var args = require('../args');

// utilizes the bump plugin to bump the
// semver for the repo
function bumpVersion(type) {
    return gulp.src(['./package.json'])
    .pipe(bump({type: type})) //major|minor|patch|prerelease
    .pipe(gulp.dest('./'));
}

gulp.task('major', function() {
  return bumpVersion('major');
});

gulp.task('minor', function() {
    return bumpVersion('minor');
});

gulp.task('patch', function() {
  return bumpVersion('patch');
});
