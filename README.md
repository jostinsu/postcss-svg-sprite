# PostCSS Svg Sprite [![Build Status][ci-img]][ci]

[PostCSS] plugin to construct SVG sprite.

[PostCSS]: https://github.com/postcss/postcss
[ci-img]:  https://travis-ci.org/jostinsu/postcss-svg-sprite.svg
[ci]:      https://travis-ci.org/jostinsu/postcss-svg-sprite

```css
.foo {
    @svgsprite common;
}
```

```css
.foo {
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

See [PostCSS] docs for examples for your environment.

