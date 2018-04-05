let path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    _ = require('lodash'),
    revHash = require('rev-hash'),
    postcss = require('postcss'),
    DOMParser = require('xmldom').DOMParser,
    Sprite = require('./lib/sprite'),
    CSS = require('./lib/css');

const ATRULEFLAG = 'svgsprite';

module.exports = postcss.plugin('postcss-svg-sprite', function (config) {

    config = _.assign({
        imagePath: false,
        spritePath: false,
        styleOutput: false,
        nameSpace: 'svg_',
        cssSeparator: '_'
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
            let start = new Date().getTime(); //开始时间 test

            root.walkAtRules(ATRULEFLAG, atRule => {
                atRules.push(atRule);
            });

            Promise.all(atRules.map(atRule => {
                return handle(atRule, config);

            })).then((results) => {
                results.forEach((result) => {
                    root.insertAfter(result.atRule, result.css);    // add css
                    result.atRule.remove();     // remove @svgsprite atrule
                    if (result.sprite) {
                        saveSprite(result.sprite.path, result.sprite.name, result.sprite.content);  // write sprite file
                    }
                });
                let end = new Date().getTime();//结束时间 test
                console.log(root.source.input.file + " 构建SVG雪碧图所消耗时间：" + (end - start) + "ms");
                reslove();
            }).catch(err => {
                reject(err);
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

        let opt = _.clone(options),
            param = _formatAtRuleParams(atRule.params),
            dirPath = '',
            svgs = [];

        if (param !== '') {
            opt.dirname = param;
            dirPath = path.resolve(process.cwd(), opt.imagePath, opt.dirname);
        } else {
            return console.log('The parameter of @svgsprite can not be empty');
        }

        fs.readdir(dirPath, (err, sourceFiles) => {

            if (err) {
                throw err;
            }

            if (!sourceFiles.length) {
                console.log('There is no file in' + dirPath);
            } else {
                svgs = sourceFiles.filter(file => {    // Filtering and leaving the svg file only
                    return _isSvgFile(file, dirPath);
                });
            }

            return Promise.all(svgs.map(function (svg) {
                let svgPath = path.resolve(dirPath, svg);
                return new Promise((resolve, reject) => {
                    fs.readFile(svgPath, (err, content) => {
                        if (err) {
                            reject(err);
                        }
                        resolve({
                            path: svgPath,
                            content: content,
                            hash: revHash(content)
                        });
                    });
                });
            })).then(svgs => {
                if (!svgs.length) {
                    console.log('There is no svg file in' + dirPath);
                    resolve({
                        atRule: atRule,
                        css: '',
                        sprite: null
                    });
                } else {
                    let sprite = new Sprite(svgs, opt),
                        css = getCss(sprite.shapes, opt);

                    resolve({
                        atRule: atRule,
                        css: css,
                        sprite: {
                            content: sprite.sprite,
                            name: opt.dirname + '.svg',
                            path: path.resolve(process.cwd(), opt.spritePath)
                        },
                    });
                }
            }).catch(err => {
                console.log(err);
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
    let spritePath = path.resolve(process.cwd(), options.spritePath, options.dirname + '.svg');
    let spriteRelative = path.relative(options.styleOutput, spritePath);

    return new CSS(shapes, {
        nameSpace: options.nameSpace,
        block: options.dirname,
        separator: options.cssSeparator,
        spriteRelative: spriteRelative
    }).getCss();
}

/**
 * save sprite which was constructed by svg files
 *
 * @param  {String} spritePath
 * @param  {String} spriteName
 * @param  {String} spriteContent
 */
function saveSprite(spritePath, spriteName, spriteContent) {
    mkdirp.sync(spritePath);
    try {
        fs.writeFileSync(path.resolve(spritePath, spriteName), new Buffer(spriteContent));
        console.log(path.resolve(spritePath, spriteName) + " had been constructed!")
    } catch (err) {
        throw err;
    }
}

/**
 *  Format the parameter of @svgsprite;
 *
 * @param  {String} value
 * @return {String}
 */
function _formatAtRuleParams(value) {
    if (/^"(.*)"$/.test(value) || /^'(.*)'$/.test(value)) {
        return value.slice(1, value.length - 1);
    }
    return '';
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
