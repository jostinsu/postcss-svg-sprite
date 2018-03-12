let path = require('path'),
	fs = require('fs'),
	File = require('vinyl'),
	_ = require('lodash'),
	postcss = require('postcss'),
	SVGSprite = require('svg-sprite'),
	Sprite = require('./lib/sprite'),
	CSS = require('./lib/css');


const ATRULEFLAG = 'svgsprite';

module.exports = postcss.plugin('postcss-svg-sprite', function (config) {

	config = _.assign({
		imagePath: false,
		spritePath: false,
		styleOutput: false,
		nameSpace: 'svg',
		cssSeparator: '_',
		spacing: 10
	}, config || {});

	// Option `imagePath` is required
	if (!config.imagePath) {
		return console.log('Option `imagePath` is undefined, Please set it and restart.');
	}

	// Option `spritePath` is required
	if (!config.spritePath) {
		return console.log('Option `spritePath` is undefined, Please set it and restart.');
	}

	// Option `styleOutput` is required
	if (!config.styleOutput) {
		return console.log('Option `styleOutput` is undefined, Please set it and restart.');
	}

	return function (root) {

		return new Promise(function (reslove, reject) {

			let atRules = [];

			root.walkAtRules(ATRULEFLAG, atRule => {
				atRules.push(atRule);
			});

			Promise.all(atRules.map(atRule => {
				return handle(atRule, config);
			})).then((results) => {
				results.forEach((result)=>{
					root.insertAfter(result.atRule, result.css);
					result.atRule.remove();
				});
				reslove();
			}).catch(err => {
				console.log(err);
			});
		});
	};
});

/**
 *  Create sprite and get css code according to the @svgsprite atrule
 *
 * @param  {Node} atRule
 * @param  {Object} options
 * @return {Promise}
 */
function handle(atRule, options) {

	return new Promise((resolve, reject) => {

		let opt = _.clone(options);
		opt.dirname = atRule.params;
		let dirPath = path.resolve(__dirname, opt.imagePath, opt.dirname);

		fs.readdir(dirPath, (err, files) => {

			if (!files.length) {
				return console.log('No file to show');
			}

			return Promise.all(files.map(function (file) {
				let svgPath = path.resolve(dirPath, file);
				return new Promise((resolve, reject) => {
					fs.readFile(svgPath, (err, content) => {
						if (err) {
							reject(err);
						}
						resolve({
							path: svgPath,
							content: content
						});
					});
				});
			})).then(files => {
				let svgs = formatSvg(dirPath, files);
				let sprite = saveSprite(svgs, opt);
				let css = getCss(sprite, opt);
				resolve({
					atRule: atRule,
					css: css
				});

			}).catch(err => {
				console.log(err);
			});

		});
	});


}

/**
 * Use svg-sprite plugin to format source files of svg
 *
 * @param  {String}  dirPath
 * @param  {Object} files
 * @return {Array} svgs
 */
function formatSvg(dirPath, files) {

	let svgs = [];
	let svgSprite = new SVGSprite({
		svg: {
			doctypeDeclaration: false,
			xmlDeclaration: false
		}
	});
	files.forEach(file => {
		svgSprite.add(new File({
			path: file.path,
			base: dirPath,
			contents: file.content
		}));
	});
	svgSprite.getShapes('', (error, result) => {
		svgs = result;
	});
	return svgs;
}

/**
 * Process the svg files to sprite
 *
 * @param  {Array} svgs
 * @param  {Object} opt
 * @return {Object} sprite
 */
function saveSprite(svgs, opt) {
	let sprite = new Sprite(svgs, {
		spacing: opt.spacing,
		fileName: opt.dirname + '.svg',
		spritePath: path.resolve(__dirname, opt.spritePath)
	});
	sprite.saveSprite();
	return sprite;
}

/**
 * Get css code which corresponding to svg sprite
 *
 * @param  {Object} sprite
 * @param  {Object} opt
 * @return {String} cssStr
 */
function getCss(sprite, opt) {
	let spritePath = path.resolve(__dirname, opt.spritePath, opt.dirname + '.svg');
	let spriteRelative = path.relative(opt.styleOutput, spritePath);

	return new CSS(sprite.shapes, {
		nameSpace: opt.nameSpace,
		block: opt.dirname,
		separator: opt.cssSeparator,
		spriteRelative: spriteRelative
	}).getCss();
}
