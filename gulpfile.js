'use strict';

const gulpLoadPlugins = require('gulp-load-plugins');
const browserSync = require('browser-sync');
const del = require('del');
const wiredep = require('wiredep').stream;
const path = require('path');

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

module.exports = function(gulp) {
  gulp.task('styles', ['images'], () => {
    return gulp.src('app/styles/*.scss')
      .pipe($.plumber())
      .pipe($.sourcemaps.init())
      .pipe($.sass.sync({
        outputStyle: 'expanded',
        precision: 10,
        includePaths: ['.']
      }).on('error', $.sass.logError))
      .pipe($.autoprefixer({browsers: ['last 1 version']}))
      .pipe($.base64({
        baseDir: 'dist/images',
        maxImageSize: 100*1024
      }))
      .pipe($.sourcemaps.write())
      .pipe(gulp.dest('.tmp/styles'))
      .pipe(reload({stream: true}));
  });

  function lint(files) {
    return () => {
      return gulp.src(files)
        .pipe(reload({stream: true, once: true}))
        .pipe($.eslint())
        .pipe($.eslint.format())
        .pipe($.if(!browserSync.active, $.eslint.failAfterError()));
    };
  }

  gulp.task('lint', lint('app/scripts/**/*.js'));
  gulp.task('lint:test', lint('test/spec/**/*.js'));

  gulp.task('html', ['styles'], () => {
    return gulp.src('app/*.html')
      .pipe($.useref({searchPath: ['.tmp', 'app', '.']}))
      .pipe($.if('*.js', $.uglify()))
      .pipe($.if('*.css', $.cleanCss({compatibility: '*'})))
      .pipe($.if('!index.html', $.rev()))
      .pipe($.revReplace())
      .pipe($.if('*.html', $.minifyHtml({conditionals: true, loose: true})))
      .pipe(gulp.dest('dist'))
      .pipe($.gzip())
      .pipe(gulp.dest('dist'));
  });

  gulp.task('images', () => {
    return gulp.src('app/images/**/*')
      .pipe($.if($.if.isFile, $.cache($.imagemin({
        progressive: true,
        interlaced: true,
        // don't remove IDs from SVGs, they are often used
        // as hooks for embedding and styling
        svgoPlugins: [{cleanupIDs: false}]
      }))
      .on('error', function (err) {
        console.log(err);
        this.end();
      })))
      .pipe(gulp.dest('dist/images'));
  });

  gulp.task('fonts', () => {
    return gulp.src(require('main-bower-files')({
      filter: '**/*.{eot,svg,ttf,woff,woff2}'
    }).concat('app/fonts/**/*'))
      .pipe(gulp.dest('.tmp/fonts'))
      .pipe(gulp.dest('dist/fonts'));
  });

  gulp.task('extras', () => {
    return gulp.src([
      'app/*.*',
      '!app/*.html'
    ], {
      dot: true
    }).pipe(gulp.dest('dist'));
  });

  gulp.task('clean', del.bind(null, ['.tmp', 'dist']));

  gulp.task('serve', ['styles', 'fonts'], () => {
    browserSync({
      notify: false,
      port: 9000,
      server: {
        baseDir: ['.tmp', 'app'],
        routes: {
          '/bower_components': 'bower_components'
        }
      }
    });

    gulp.watch([
      'app/*.html',
      'app/scripts/**/*.js',
      'app/images/**/*',
      '.tmp/fonts/**/*'
    ]).on('change', reload);

    gulp.watch('app/styles/**/*.scss', ['styles']);
    gulp.watch('app/fonts/**/*', ['fonts']);
    gulp.watch('bower.json', ['wiredep', 'fonts']);
  });

  gulp.task('serve:dist', () => {
    browserSync({
      notify: false,
      port: 9000,
      server: {
        baseDir: ['dist']
      }
    });
  });

  gulp.task('serve:test', () => {
    browserSync({
      notify: false,
      open: false,
      port: 9000,
      ui: false,
      server: {
        baseDir: 'test'
      }
    });

    gulp.watch('test/spec/**/*.js').on('change', reload);
    gulp.watch('test/spec/**/*.js', ['lint:test']);
  });

  // inject bower components
  gulp.task('wiredep', () => {
    gulp.src('app/styles/*.scss')
      .pipe(wiredep({
        ignorePath: /^(\.\.\/)+/
      }))
      .pipe(gulp.dest('app/styles'));

    gulp.src('app/*.html')
      .pipe(wiredep({
        ignorePath: /^(\.\.\/)*\.\./
      }))
      .pipe(gulp.dest('app'));
  });

  gulp.task('build', ['lint', 'images', 'html', 'fonts', 'extras'], () => {
    return gulp.src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
  });

  gulp.task('default', ['clean'], () => {
    gulp.start('build');
  });
}
