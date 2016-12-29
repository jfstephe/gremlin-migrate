var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var runSequence = require('run-sequence');
var changed = require('gulp-changed');
var plumber = require('gulp-plumber');
var paths = require('../paths');
var sourcemaps = require('gulp-sourcemaps');
var assign = Object.assign || require('object.assign');
var typescript = require('gulp-typescript');
var install = require("gulp-install");
var gulpTypings = require("gulp-typings");

// transpiles changed es6 files to SystemJS format
// the plumber() call prevents 'pipe breaking' caused
// by errors from other gulp plugins
// https://www.npmjs.com/package/gulp-plumber
var typescriptCompiler = typescriptCompiler || null;

gulp.task('buildts', function() {
  if (!typescriptCompiler) {
    typescriptCompiler = typescript.createProject('tsconfig.json', {
      "typescript": require('typescript')
    });
  }
  return gulp.src(paths.dtsSrc.concat(paths.getSourceTs()))
    .pipe(plumber())
    .pipe(changed(paths.getOutputRoot(), {extension: '.js'}))
    .pipe(sourcemaps.init()) // This means sourcemaps will be generated
    .pipe(typescriptCompiler())
    .pipe(sourcemaps.write()) // Now the sourcemaps are added to the .js file
    .pipe(gulp.dest(paths.getOutputRoot()));
});

gulp.task('copyPackageJson', function() {
  return gulp.src(paths.packageJson)
    .pipe(gulp.dest(paths.getOutputRoot()));
});

gulp.task('copyUpgradeScripts', function() {
  return gulp.src(paths.upgradeScriptDirectory)
    .pipe(gulp.dest(paths.getOutputUpgradeScripts()));
});

gulp.task('installDependencies', function() {
  return gulp.src(paths.packageJson)
    .pipe(gulp.dest(paths.getOutputRoot()))
    .pipe(install({production: true}));  
});

gulp.task('installTypings', function() {
    return gulp.src(paths.typings)
        .pipe(gulpTypings());
});

// this task calls the clean task (located
// in ./clean.js), then runs the build-system
gulp.task('build', function(callback) {
  return runSequence(
    ['clean'],
    ['build-unclean'],
    callback
  );
});


gulp.task('dummy', () => {});

// this task calls the clean task (located
// in ./clean.js), then runs the build-system
gulp.task('build-unclean', function(callback) {
  var preBuildSteps;
  var buildSteps;
  var postBuildSteps;
  if (paths.getIsExport()) {
    preBuildSteps = ['installTypings', 'copyPackageJson'];
    buildSteps = ['buildts', 'copyUpgradeScripts', 'installDependencies'];
    postBuildSteps = [ 'removeOutputPackageJson'];
  }
  else {
    preBuildSteps = ['installTypings'];
    buildSteps = ['buildts', 'copyUpgradeScripts'];
    postBuildSteps = ['dummy'];
  }
  return runSequence(
    ['lint'],
    preBuildSteps,
    buildSteps,
    postBuildSteps,
    callback
  );
});