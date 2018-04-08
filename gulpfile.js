let gulp = require('gulp'),
	postcss = require('gulp-postcss'),
	svgSprite = require('./index.js');

gulp.task('sprite', function () {
	return gulp.src('./example/src/css/*.css')
		.pipe(postcss([svgSprite({
			imagePath: './example/src/svg',
            spriteOutput: './example/dist/sprite',
			styleOutput: './example/dist/css',
			nameSpace: 'demo_',
		})]))
		.pipe(gulp.dest('./example/dist/css'));
});

gulp.task('watchCss', function () {
	gulp.watch('example/src/css/*.css', ['sprite']);
});

gulp.task('watchSvg', function () {
    gulp.watch('example/src/svg/*/*.svg', ['sprite']);
});

gulp.task('default', ['sprite', 'watchCss', 'watchSvg']);


