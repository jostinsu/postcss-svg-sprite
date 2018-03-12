let gulp = require('gulp'),
	postcss = require('gulp-postcss'),
	svgSprite = require('./index.js');

gulp.task('sprite', function () {
	return gulp.src('./example/src/css/*.css')
		.pipe(postcss([svgSprite({
			imagePath: './example/src/svg',
			spritePath: './example/dist/sprite',
			styleOutput: './example/dist/css',
			nameSpace: 'demo',
		})]))
		.pipe(gulp.dest('./example/dist/css'));
});

gulp.task('watch', function () {
	gulp.watch('./example/src/css/*.css', ['sprite']);
});

gulp.task('default', ['sprite', 'watch']);


