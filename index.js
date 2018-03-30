let path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
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

            root.walkAtRules(ATRULEFLAG, atRule => {
                atRules.push(atRule);
            });

            Promise.all(atRules.map(atRule => {
                return handle(atRule, config);

            })).then((results) => {
                results.forEach((result) => {
                    root.insertAfter(result.atRule, result.css);    // add css
                    result.atRule.remove();     // remove @svgsprite atrule
                    saveSprite(result.sprite.path, result.sprite.name, result.sprite.content);  // write sprite file
                });
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
            files = [];

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
                console.log('There si no file in' + dirPath);
            } else {
                files = sourceFiles.filter(file => { // Filtering and leaving the svg file only
                    return _isSvgFile(file, dirPath);
                });
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
                if (!files.length) {
                    console.log('There si no svg file in' + dirPath);
                } else {
                    formatSvg(dirPath, files).then(svgs => {
                        let sprite = new Sprite(svgs),
                            spriteFile = sprite.getSprite(),
                            css = getCss(sprite, opt);

                        resolve({
                            atRule: atRule,
                            css: css,
                            sprite: {
                                content: spriteFile,
                                name: opt.dirname + '.svg',
                                path: path.resolve(process.cwd(), opt.spritePath)
                            },
                        });
                    }).catch((err) => {
                        console.log(err);
                    });
                }
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
 * @return {Promise}
 */
function formatSvg(dirPath, files) {

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

    return new Promise((resolve, reject) => {
        svgSprite.getShapes('', (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        });
    });
}

/**
 * Get css code which corresponding to svg sprite
 *
 * @param  {Object} sprite
 * @param  {Object} option
 * @return {String} cssStr
 */
function getCss(sprite, option) {
    let spritePath = path.resolve(process.cwd(), option.spritePath, option.dirname + '.svg');
    let spriteRelative = path.relative(option.styleOutput, spritePath);

    return new CSS(sprite.shapes, {
        nameSpace: option.nameSpace,
        block: option.dirname,
        separator: option.cssSeparator,
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
    fs.writeFile(path.resolve(spritePath, spriteName), new Buffer(spriteContent), (err) => {
        if (err) {
            throw err;
        }
        console.log(path.resolve(spritePath, spriteName) + " had been constructed!")
    });
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
