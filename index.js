let path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    _ = require('lodash'),
    revHash = require('rev-hash'),
    postcss = require('postcss'),
    Sprite = require('./lib/sprite'),
    CSS = require('./lib/css');

const ATRULEFLAG = 'svgsprite';

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
        throw new Error('Option `imagePath` is undefined, Please set it and restart.');
    }

    // Option `spriteOutput` is required
    if (!config.spriteOutput) {
        throw new Error('Option `spriteOutput` is undefined, Please set it and restart.');
    }

    // Option `styleOutput` is required
    if (!config.styleOutput) {
        throw new Error('Option `styleOutput` is undefined, Please set it and restart.');
    }

    return function (root) {

        return new Promise(function (reslove, reject) {

            let atRules = [];
            // let start = new Date().getTime(); //开始时间 test

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
                        saveSprite(result.sprite.spritePath, result.sprite.contents);  // write sprite file
                    }
                });
                // let end = new Date().getTime();//结束时间 test
                // console.log(root.source.input.file + " 构建SVG雪碧图所消耗时间：" + (end - start) + "ms");
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
            svgs = [];

        if (param !== '') {
            opt.dirname = param;
            opt.svgDir = path.resolve(process.cwd(), opt.imagePath, opt.dirname);
            opt.spriteOutput = path.resolve(process.cwd(), opt.spriteOutput);
            opt.spritePath = path.resolve(opt.spriteOutput, opt.dirname + '.svg');
        } else {
            return console.log('The parameter of @svgsprite can not be empty');
        }

        fs.readdir(opt.svgDir, (err, sourceFiles) => {

            if (err) {
                throw err // TODO 找不到该图片
            }

            if (!sourceFiles.length) {
                console.log('There is no file in' + opt.svgDir);
            } else {
                svgs = sourceFiles.filter(file => {    // Filtering and leaving the svg file only
                    return _isSvgFile(file, opt.svgDir);
                });
            }

            return Promise.all(svgs.map(function (svg) {
                let svgPath = path.resolve(opt.svgDir, svg);
                return new Promise((resolve, reject) => {
                    fs.readFile(svgPath, (err, contents) => {
                        if (err) {
                            reject(err);
                        }
                        resolve({
                            path: svgPath,
                            contents: contents,
                            id: revHash(contents)
                        });
                    });
                });
            })).then(svgs => {
                if (!svgs.length) {
                    console.log('There is no svg file in' + opt.svgDir);
                    resolve({
                        atRule: atRule,
                        css: '',
                        sprite: null
                    });
                } else {
                    let sprite = new Sprite(svgs, {
                        spritePath: opt.spritePath,
                        svgDir: opt.svgDir
                    });
                    if (sprite.isSvgsChange()) {
                        sprite.getShapesFromSvgs().then(() => {
                            let spriteContent = sprite.getSprite();
                            resolve({
                                atRule: atRule,
                                css: getCss(sprite.shapes, opt),
                                sprite: {
                                    contents: spriteContent,
                                    spritePath: opt.spritePath,
                                },
                            });
                        }).catch(err => {
                            throw err;
                        });
                    } else {
                        let shapes = sprite.getShapesFromSprite();
                        resolve({
                            atRule: atRule,
                            css: getCss(shapes, opt),
                            sprite: null,
                        });
                    }
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
    let spriteRelative = path.relative(options.styleOutput, options.spritePath);
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
 * @param  {String} spriteContents
 */
function saveSprite(spritePath, spriteContents) {
    mkdirp.sync(path.dirname(spritePath));
    try {
        fs.writeFileSync(spritePath, new Buffer(spriteContents));
        console.log(spritePath + " had been constructed!")
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
