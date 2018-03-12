# PostCSS Svg Sprite [![Build Status][ci-img]][ci]

[PostCSS] plugin to construct SVG sprite.

[PostCSS]: https://github.com/postcss/postcss
[ci-img]:  https://travis-ci.org/jostinsu/postcss-svg-sprite.svg
[ci]:      https://travis-ci.org/jostinsu/postcss-svg-sprite

## Example

Input

```css

@svgsprite common;

```

Output

```css
.demo_common {
    background: url("../sprite/common.svg") left top no-repeat;
    display: inline-block;
    overflow: hidden;
    font-size: 0;
    line-height: 0;
    vertical-align: top;
}

.demo_common_AddMemberSmallGray {
    width: 14px;
    height: 14px;
    background-position: -74px -26px;
}

.demo_common_ArrowGrayDown6h {
    width: 10px;
    height: 6px;
    background-position: -44px -30px;
}
```

## Usage

Work with Gulp

```js
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
```
## Options

#### imagePath:
> Relative path to the folder that svgs are stored.

#### styleOutput:
> Relative path to the folder that will keep your output stylesheet(s).

#### spritePath:
> Relative path to the folder that will keep your output sprite(s).

#### nameSpace:
> NameSpace(Prefix) of the class name of each svg.

#### cssSeparator:
> Separator between css selector's 'block' and 'element'. In this plugin. 'block' is equal to file dirname or dynamic one, 'element' is the base name of file.

See [PostCSS] docs for examples for your environment.

