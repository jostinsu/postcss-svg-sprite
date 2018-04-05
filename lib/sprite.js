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
        this.id = '';
        this.sprite = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg>';
        this.dom = new DOMParser().parseFromString(this.sprite);
        this.width = 0;
        this.height = 0;
        this.spritePath = path.resolve(process.cwd(), options.spritePath, options.dirname + '.svg');

        //svgs info
        this.svgPath = path.resolve(process.cwd(), options.imagePath, options.dirname);

        // shape info
        this.shapes = [];
        this.spacing = 10;

        this._init(svgs);
    }

    _init(svgs) {
        if (this.isNeedUpdateSprite(svgs)) {
            this.shapes = Sprite.getShapesFromSvgs(Sprite.formatSvg(svgs, this.svgPath));
            this._getSprite();
        } else {
            this.shapes = Sprite.getShapesFromSprite(this.spritePath);
        }
    }

    _getSprite() {
        let layoutInfo = Sprite.layout(this.shapes, this.spacing);
        this._updateRootDom(layoutInfo.width, layoutInfo.height);
        this._updateShapeDom(layoutInfo.items);
        this._makeSprite();
    }

    _makeSprite() {
        this.shapes.forEach((shape) => {
            this.dom.documentElement.appendChild(shape.dom);
        });
        this.sprite = '<?xml version="1.0" encoding="utf-8"?>' + new XMLSerializer().serializeToString(this.dom.documentElement);
    }

    _updateRootDom(width, height) {
        console.log("======" + this.id);
        this.width = width;
        this.height = height;
        this.dom.documentElement.setAttribute('width', this.width);
        this.dom.documentElement.setAttribute('height', this.height);
        this.dom.documentElement.setAttribute('id', this.id);
        this.dom.documentElement.setAttribute('data-total', this.shapes.length);
    }

    _updateShapeDom(shapesLayoutInfo) {
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

    static layout(shapes, spacing) {
        let layer = layout('binary-tree');
        shapes.forEach(shape => {
            let width = shape.attr.width + spacing;
            let height = shape.attr.height + spacing;
            layer.addItem({'width': width, 'height': height, 'meta': shape.name});
        });
        return layer['export']();
    }

    static getShapesFromSvgs(svgs) {
        let shapes = [];
        svgs.forEach(svg => {
            let dom = new DOMParser().parseFromString(svg.contents.toString(), 'image/svg-xml');
            shapes.push({
                name: path.basename(svg.path, '.svg'),
                dom: dom,
                attr: {
                    width: parseInt(dom.documentElement.getAttribute('width')),
                    height: parseInt(dom.documentElement.getAttribute('height'))
                }
            });
        });
        return shapes;
    }

    static getShapesFromSprite(sprite) {
        try {
            this.sprite = fs.readFileSync(sprite, 'UTF-8');
            console.log("getShapesFromSprite: sprite" + this.sprite);
            let spriteDom = new DOMParser().parseFromString(this.sprite, 'image/svg-xml'),
                svgDoms = spriteDom.documentElement.childNodes,
                shapes = [];
            for (let index in svgDoms) {
                let dom = svgDoms[index];
                if (dom.nodeName === 'svg') {
                    shapes.push({
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
            return shapes;
        } catch (err) {
            throw err;
        }
    }

    static formatSvg(svgs, dirPath) {
        let svgSprite = new SVGSprite({
            svg: {
                doctypeDeclaration: false,
                xmlDeclaration: false
            }
        });
        svgs.forEach(file => {
            svgSprite.add(new File({
                path: file.path,
                base: dirPath,
                contents: file.content
            }));
        });
        svgSprite.getShapes('', (err, result) => {
            if (err) {
                console.log(err);
            }
            svgs = result;
        });
        return svgs;
    }

    isNeedUpdateSprite(svgs) {
        let flag = false,
            spriteInfo = this.getSpriteInfo();
        this.id = md5(_.sortBy(svgs, ['hash']).join('&')).slice(0, 10);

        if (!spriteInfo) {  // When sprite hash is changed, the sprite needs to be updated
            flag = true;
            console.log("1");
        } else if (parseInt(spriteInfo.svgTotal) !== svgs.length) {  // When svg is added or deleted, sprite needs to be updated
            console.log("spriteInfo.svgTotal: " + spriteInfo.svgTotal);
            console.log("svgs.length: " + svgs.length);
            console.log("2");
            flag = true;
        } else if (spriteInfo.id !== this.id) {   // When sprite hash is changed, the sprite needs to be updated
            console.log("3");
            flag = true;
        }
        console.log(flag);
        return flag;
    }

    getSpriteInfo() {
        try {
            let spriteDom = new DOMParser().parseFromString(fs.readFileSync(this.spritePath, 'UTF-8'), 'image/svg-xml');
            let total = spriteDom.documentElement.getAttribute('data-total');
            if (!total) {
                console.log("data-total: "+ total);
                console.log("id: "+ spriteDom.documentElement.getAttribute('id'));
                console.log("spritePath: "+ this.spritePath);
                console.log("sprite: "+ fs.readFileSync(this.spritePath, 'UTF-8'));
            }

            return {
                id: spriteDom.documentElement.getAttribute('id'),
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
}

module.exports = Sprite;





