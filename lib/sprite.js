let path = require('path'),
	layout = require('layout'),
	_ = require('lodash'),
	fs = require('fs'),
	md5 = require('spark-md5').hash,
	DOMParser = require('xmldom').DOMParser,
	XMLSerializer = require('xmldom').XMLSerializer,
	PluginError = require('plugin-error'),
	File = require('vinyl'),
	SVGSprite = require('svg-sprite');

const PLUGINNAME = 'postcss-svg-sprite';

class Sprite {

	constructor(svgs, options) {

		// sprite info
		this.spriteId = '';
		this.spritePath = options.spritePath;
		this.spriteContents = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg>';
		this.spriteDoc = new DOMParser().parseFromString(this.spriteContents);

		//svgs info
		this.svgs = svgs;
		this.svgDir = options.svgDir;

		// shape info
		this.shapes = [];
		this.spacing = 10;
		this.layout = {};
	}

	isSvgsChange() {
		let flag = false,
			spriteInfo = this._getSpriteInfo();
		this.spriteId = md5(_.sortBy(this.svgs, ['id']).join('&'));

		if (!spriteInfo) {  // When no info about sprite, it means need to generate a new sprite
			flag = true;
		} else if (parseInt(spriteInfo.svgTotal) !== this.svgs.length) {  // When svgs length changes, it means svgs add or delete,
			flag = true;
		} else if (spriteInfo.spriteId !== this.spriteId) {   // When sprite id changes, it means svgs change also;
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
			};
		} catch (err) {
			if (err.code === 'ENOENT') {
				return null;    // when can not find sprite file return null
			} else {
				throw new PluginError(PLUGINNAME, err);
			}
		}
	}

	getSprite() {
		this._updateRootDom();
		this.shapes.forEach((shape) => {
			this.spriteDoc.documentElement.appendChild(shape.dom);
		});
		return this.spriteContents = '<?xml version="1.0" encoding="utf-8"?>' + new XMLSerializer().serializeToString(this.spriteDoc.documentElement);
	}

	_updateRootDom() {
		this.spriteDoc.documentElement.setAttribute('width', this.layout.width);
		this.spriteDoc.documentElement.setAttribute('height', this.layout.height);
		this.spriteDoc.documentElement.setAttribute('data-sprite-id', this.spriteId);
		this.spriteDoc.documentElement.setAttribute('data-total', this.svgs.length.toString());
	}

	_updateShapeDom() {
		this.shapes.forEach((shape, index) => {
			let shapeLayoutInfo = this.layout.items[index];
			if (shape.name === shapeLayoutInfo.meta) {
				shape.attr.x = shapeLayoutInfo.x;
				shape.attr.y = shapeLayoutInfo.y;
				shape.dom.setAttribute('x', shape.attr.x);
				shape.dom.setAttribute('y', shape.attr.y);
				shape.dom.setAttribute('data-name', shape.name);
				shape.dom.setAttribute('data-svg-id', shape.id);
			}
		});
	}

	getShapesFromSvgs() {
		let svgs = [];
		try {
			svgs = Sprite.filterSvgs(this.svgs, this.getShapesFromSprite(this.spritePath), shape => {
				this.shapes.push(shape);
			});
		} catch (err) {
			if (err.code === 'ENOENT') {
				svgs = this.svgs;    // when can not find sprite file, svgs = this.svgs
			} else {
				throw new PluginError(PLUGINNAME, err);
			}
		}

		return Sprite.formatSvg(svgs, this.svgDir).then(svgs => {
			svgs.forEach(svg => {
				let doc = new DOMParser().parseFromString(svg.file.contents.toString(), 'image/svg-xml');
				this.shapes.push({
					name: path.basename(svg.file.path, '.svg'),
					id: svg.id,
					dom: doc.documentElement,
					attr: {
						width: doc.documentElement.getAttribute('width'),
						height: doc.documentElement.getAttribute('height')
					}
				});
			});
			this.layout = Sprite.layout(this.shapes, this.spacing);
			this._updateShapeDom();
			return Promise.resolve(this.shapes);
		}).catch(err => {
			throw new PluginError(PLUGINNAME, err);
		});
	}

	getShapesFromSprite() {
		try {
			let spriteDoc = new DOMParser().parseFromString(fs.readFileSync(this.spritePath, 'UTF-8'), 'image/svg-xml'),
				svgDoms = spriteDoc.documentElement.getElementsByTagName('svg'),
				shapes = [];
			for (let index = 0; index < svgDoms.length; index++) {
				let dom = svgDoms[index];
				shapes.push({
					dom: dom,
					name: dom.getAttribute('data-name'),
					id: dom.getAttribute('data-svg-id'),
					attr: {
						width: dom.getAttribute('width'),
						height: dom.getAttribute('height'),
						x: parseInt(dom.getAttribute('x') || '0'),  // Sometimes, the 0 value in sprite will be filtered by other plugin
						y: parseInt(dom.getAttribute('y') || '0'),
					}
				});
			}
			return shapes;
		} catch (err) {
			throw new PluginError(PLUGINNAME, err);
		}
	}

	static filterSvgs(svgs, shapes, cb) {
		return svgs.filter((svg) => {
			let flag = true;
			for (let index = 0; index < shapes.length; index++) {
				if (svg.id === shapes[index].id) {
					cb(shapes[index]);
					flag = false;
					break;
				}
			}
			return flag;
		});
	}

	static formatSvg(svgs, svgDir) { // TODO 性能瓶颈，改用自己实现
		let svgSprite = new SVGSprite({
			svg: {
				doctypeDeclaration: false,
				xmlDeclaration: false
			}
		});
		svgs.forEach(svg => {
			svgSprite.add(new File({
				path: svg.path,
				base: svgDir,
				contents: svg.contents,
			}));
		});

		return new Promise((resolve, reject) => {
			svgSprite.getShapes('', (err, result) => {
				if (err) {
					reject(err);
				}
				resolve(result.map(svg => {
					let id = '';
					for (let index = 0; index < svgs.length; index++) {
						if (svg.path === svgs[index].path.split(path.sep).pop()) {
							id = svgs[index].id;
							break;
						}
					}
					return {
						file: svg,
						id: id
					};
				}));
			});
		});
	}

	static layout(shapes, spacing) {
		let layer = layout('binary-tree');
		shapes.forEach(shape => {
			let width = parseInt(shape.attr.width) + spacing;
			let height = parseInt(shape.attr.height) + spacing;
			layer.addItem({'width': width, 'height': height, 'meta': shape.name});
		});
		return layer['export']();
	}
}

module.exports = Sprite;





