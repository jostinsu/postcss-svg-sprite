let path = require('path'),
    layout = require('layout'),
    _ = require('lodash'),
    fs = require('fs'),
    md5 = require('spark-md5').hash,
    DOMParser = require('xmldom').DOMParser,
    XMLSerializer = require('xmldom').XMLSerializer,
    File = require('vinyl'),
    SVGSprite = require('svg-sprite');

class Sprite {

    constructor(svgs, options) {

        // sprite info
        this.spriteId = '';
        this.spritePath = options.spritePath;
        this.spriteContents = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg>';
        this.spriteDom = new DOMParser().parseFromString(this.spriteContents);
        this.spriteWidth = 0;
        this.spriteHeight = 0;

        //svgs info
        this.svgs = svgs;
        this.svgDir = options.svgDir;

        // shape info
        this.shapes = [];
        this.spacing = 10;
    }

    isSvgsHaveChanged() {
        let flag = false,
            spriteInfo = this._getSpriteInfo();
        this.spriteId = md5(_.sortBy(this.svgs, ['id']).join('&'));

        if (!spriteInfo) {  // When sprite hash is changed, the sprite needs to be updated
            flag = true;
            console.log("还没生成过该图");
        } else if (parseInt(spriteInfo.svgTotal) !== this.svgs.length) {  // When svg is added or deleted, sprite needs to be updated
            // console.log("spriteInfo.svgTotal: " + spriteInfo.svgTotal);
            // console.log("svgs.length: " + this.svgs.length);
            console.log("数量变化");
            flag = true;
        } else if (spriteInfo.spriteId !== this.spriteId) {   // When sprite id is changed, the sprite needs to be updated
            console.log("hash变化");
            flag = true;
        }
        return flag;
    }

    _getSpriteInfo() {
        try {
            let spriteDom = new DOMParser().parseFromString(fs.readFileSync(this.spritePath, 'UTF-8'), 'image/svg-xml');
            return {
                spriteId: spriteDom.documentElement.getAttribute('data-sprite-id'),
                svgTotal: spriteDom.documentElement.getAttribute('data-total')
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                return null;    // when can not find sprite file return null
            } else {
                throw err;
            }
        }
    }

    getSprite() {
        let layoutInfo = Sprite.layout(this.shapes, this.spacing);
        this._updateRootDom(layoutInfo.width, layoutInfo.height);
        this._updateShapeDom(layoutInfo.items);
        return this._makeSprite();
    }

    _makeSprite() {
        this.shapes.forEach((shape) => {
            this.spriteDom.documentElement.appendChild(shape.dom);
        });
        return this.spriteContents = '<?xml version="1.0" encoding="utf-8"?>' + new XMLSerializer().serializeToString(this.spriteDom.documentElement);
    }

    _updateRootDom(width, height) {
        this.spriteWidth = width;
        this.spriteHeight = height;
        this.spriteDom.documentElement.setAttribute('width', this.spriteWidth);
        this.spriteDom.documentElement.setAttribute('height', this.spriteHeight);
        this.spriteDom.documentElement.setAttribute('data-sprite-id', this.spriteId);
        this.spriteDom.documentElement.setAttribute('data-total', this.shapes.length.toString());
    }

    _updateShapeDom(shapesLayoutInfo) { //TODO 写入的时候增加data-id字段
        this.shapes.forEach((shape, index) => {
            if (shape.name === shapesLayoutInfo[index].meta) {
                shape.attr.x = shapesLayoutInfo[index].x;
                shape.attr.y = shapesLayoutInfo[index].y;
                shape.dom.documentElement.setAttribute('x', shape.attr.x);
                shape.dom.documentElement.setAttribute('y', shape.attr.y);
                shape.dom.documentElement.setAttribute('data-name', shape.name);
            }
        });
    }

    getShapesFromSvgs() {
        return this._formatSvg().then(svgs => {
            svgs.forEach(svg => {
                let dom = new DOMParser().parseFromString(svg.contents.toString(), 'image/svg-xml');
                this.shapes.push({
                    name: path.basename(svg.path, '.svg'),
                    dom: dom,
                    attr: {
                        width: parseInt(dom.documentElement.getAttribute('width')),
                        height: parseInt(dom.documentElement.getAttribute('height'))
                    }
                });
            });
        }).catch(err => {
            throw err;
        });
    }

    _formatSvg() {

        this.getShapesFromSprite(); //TODO 获取shapes 比较data-id 判断哪些source svg需要进行format， 再与现有的构成一个全新的shapes
        // TODO 抽离成一个独立方法

        let svgSprite = new SVGSprite({
            svg: {
                doctypeDeclaration: false,
                xmlDeclaration: false
            }
        });
        this.svgs.forEach(svg => {
            svgSprite.add(new File({
                path: svg.path,
                base: this.svgDir,
                contents: svg.contents,
            }));
        });

        return new Promise((resolve, reject) => {
            svgSprite.getShapes('', (err, svgs) => {
                if (err) {
                    reject();
                }
                resolve(svgs);
            });
        });
    }

    getShapesFromSprite() { // TODO 改成静态方法 shape中添加 data-id 字段（hash）
        try {
            this.spriteContents = fs.readFileSync(this.spritePath, 'UTF-8'); // TODO 不明白其作用
            let spriteDom = new DOMParser().parseFromString(this.spriteContents, 'image/svg-xml'),
                svgDoms = spriteDom.documentElement.childNodes;
            for (let index in svgDoms) {
                let dom = svgDoms[index];
                if (dom.nodeName === 'svg') {
                    this.shapes.push({
                        name: dom.getAttribute('data-name'),
                        attr: {
                            width: dom.getAttribute('width'),
                            height: dom.getAttribute('height'),
                            x: dom.getAttribute('x'),
                            y: dom.getAttribute('y'),
                        }
                    });
                }
            }
            return this.shapes;
        } catch (err) {
            throw err;
        }
    }

    static layout(shapes, spacing) {
        let layer = layout('binary-tree');
        shapes.forEach(shape => {
            let width = shape.attr.width + spacing;
            let height = shape.attr.height + spacing;
            layer.addItem({'width': width, 'height': height, 'meta': shape.name});
        });
        return layer['export']();
    }
}

module.exports = Sprite;





