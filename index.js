const path = require('path'),
	fs = require('fs'),
	mkdirp = require('mkdirp'),
	_ = require('lodash'),
	crypto = require('crypto'),
	colors = require('ansi-colors'),
	fancyLog = require('fancy-log'),
	PluginError = require('plugin-error'),
	postcss = require('postcss'),
	Sprite = require('./lib/sprite'),
	CSS = require('./lib/css');

const ATRULEFLAG = 'svgsprite';
const PLUGINNAME = 'postcss-svg-sprite';


module.exports = postcss.plugin('postcss-svg-sprite', function (config) {

	config = _.assign({
		imagePath: false,
		spriteOutput: false,
		styleOutput: false,
		nameSpace: 'svg_',
		cssSeparator: '_'
	}, config || {});


	// Option `imagePath` is required
	if (!config.imagePath) {
		// throw new Error('Option `imagePath` is undefined, Please set it and restart.');
		throw log('Option `imagePath` is undefined, Please set it and restart.', 'error');
	}

	// Option `spriteOutput` is required
	if (!config.spriteOutput) {
		throw log('Option `spriteOutput` is undefined, Please set it and restart.', 'error');
	}

	// Option `styleOutput` is required
	if (!config.styleOutput) {
		throw log('Option `styleOutput` is undefined, Please set it and restart.', 'error');
	}

	return function (root) {

		return new Promise(function (reslove, reject) {

			const atRules = [];

			root.walkAtRules(ATRULEFLAG, atRule => {
				atRules.push(atRule);
			});

			Promise.all(atRules.map(atRule => {
				return handle(atRule, config);

			})).then((results) => {
				results.forEach((result) => {
					root.insertAfter(result.atRule, result.css);    // add css
					result.atRule.remove();     // remove @svgsprite atRule
					if (result.sprite) {
						saveSprite(result.sprite.spritePath, result.sprite.contents);  // write sprite file
					}
				});
				reslove();
			}).catch(err => {
				reject(err);
				throw new PluginError(PLUGINNAME, err);
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
		const param = _formatAtRuleParams(atRule.params),
			opt = _.clone(options);
		let svgs = [];

		if (param !== '') {
			opt.dirname = param;
			opt.svgDir = path.resolve(process.cwd(), opt.imagePath, opt.dirname);
			opt.spriteOutput = path.resolve(process.cwd(), opt.spriteOutput);
			opt.spritePath = path.resolve(opt.spriteOutput, opt.dirname + '.svg');
		} else {
			log('The parameter of @svgsprite can not be empty!', 'warn');
			return resolve({
				atRule: atRule,
				css: '',
				sprite: null
			});
		}

		fs.readdir(opt.svgDir, (err, sourceFiles) => {

			if (err) {
				return reject(err);
			}

			svgs = sourceFiles.filter(file => {    // Filtering and leaving the svg file only
				return _isSvgFile(file, opt.svgDir);
			});

			return Promise.all(svgs.map(function (svg) {
				const svgPath = path.resolve(opt.svgDir, svg);
				return new Promise((resolve, reject) => {
					fs.readFile(svgPath, (err, contents) => {
						if (err) {
							reject(err);
						}
						resolve({
							path: svgPath,
							contents: contents,
							id: crypto.createHash('md5').update(contents).digest('hex').slice(0, 10)
						});
					});
				});
			})).then(svgs => {
				if (!svgs.length) { // no svg file
					log(`There is no svg file in ${opt.svgDir}`, 'warn');
					resolve({
						atRule: atRule,
						css: '',
						sprite: null
					});
				} else {
					const sprite = new Sprite(svgs, {
						spritePath: opt.spritePath,
						svgDir: opt.svgDir
					});
					if (sprite.isSvgsChange()) {    // svg files change
						sprite.getShapesFromSvgs().then((shapes) => {
							resolve({
								atRule: atRule,
								css: getCss(shapes, opt),
								sprite: {
									contents: sprite.getSprite(),
									spritePath: opt.spritePath,
								},
							});
						}).catch(err => {
							reject(err);
						});
					} else {    // svg files do not change
						const shapes = sprite.getShapesFromSprite();
						resolve({
							atRule: atRule,
							css: getCss(shapes, opt),
							sprite: null,
						});
					}
				}
			}).catch(err => {
				reject(err);
			});

		});
	});
}

/**
 * Get css code which corresponding to svg sprite
 *
 * @param  {Object} shapes
 * @param  {Object} options
 * @return {String} cssStr
 */
function getCss(shapes, options) {
	const spriteRelative = path.relative(options.styleOutput, options.spritePath);
	return new CSS(shapes, {
		nameSpace: options.nameSpace,
		block: options.dirname,
		separator: options.cssSeparator,
		spriteRelative: path.normalize(spriteRelative).replace(/\\/g, '/')
	}).getCss();
}

/**
 * save sprite
 *
 * @param  {String} spritePath
 * @param  {String} spriteContents
 */
function saveSprite(spritePath, spriteContents) {
	mkdirp.sync(path.dirname(spritePath));
	try {
		fs.writeFileSync(spritePath, new Buffer(spriteContents));
		fancyLog(`${PLUGINNAME}: ${colors.green(`had generated ${spritePath}`)}`);
	} catch (err) {
		throw new PluginError(PLUGINNAME, err);
	}
}

/**
 * Format the parameter of @svgsprite;
 *
 * @param  {String} value
 * @return {String}
 */
function _formatAtRuleParams(value) {
	if (/^"(.*)"$/.test(value) || /^'(.*)'$/.test(value)) {
		return value.slice(1, value.length - 1);
	}
	return value;
}

/**
 *  Determine whether the current file is an svg file
 *
 * @param  {String} file
 * @param  {String} dirPath
 * @return {Boolean}
 */
function _isSvgFile(file, dirPath) {
	let flag = false,
		isFile = fs.statSync(path.resolve(dirPath, file)).isFile();

	if (isFile) {   // Exclude directory
		if (path.extname(file) === '.svg') {    // Only accept files which with svg suffix
			flag = true;
		}
	}
	return flag;
}


/**
 * Format log based on different types
 *
 * @param  {String} msg
 * @param  {String} type
 */
function log(msg, type) {
	switch (type) {
	case 'error':
		fancyLog(`${PLUGINNAME}: ${colors.red(`Error, ${msg}`)}`);
		break;

	case 'warn':
		fancyLog(`${PLUGINNAME}: ${colors.yellow(`Warning, ${msg}`)}`);
		break;

	case 'info':
		fancyLog(`${PLUGINNAME}: ${colors.green(`Info, ${msg}`)}`);
		break;

	default:
		fancyLog(`${PLUGINNAME}: ${colors.green(`Info, ${msg}`)}`);
		break;
	}

}
