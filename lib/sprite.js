let path = require('path'),
	layout = require('layout'),
	DOMParser = require('xmldom').DOMParser,
	XMLSerializer = require('xmldom').XMLSerializer;

class Sprite {

	constructor(svgs) {

		// file info
		this.sprite = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg>';
		this.dom = new DOMParser().parseFromString(this.sprite);
		this.width = 0;
		this.height = 0;

		// shape info
		this.shapes = Sprite.getShapes(svgs);
		this.spacing = 10;
	}

	getSprite() {
		let layoutInfo = Sprite.layout(this.shapes, this.spacing);
		this._updateRootDom(layoutInfo.width, layoutInfo.height);
		this._updateShapeDom(layoutInfo.items);
		return this._makeSprite();
	}

	_makeSprite() {
		this.shapes.forEach((shape) => {
			this.dom.documentElement.appendChild(shape.dom);
		});
		this.sprite = '<?xml version="1.0" encoding="utf-8"?>' + new XMLSerializer().serializeToString(this.dom.documentElement);
		return this.sprite;
	}

	_updateRootDom(width, height) {
		this.width = width;
		this.height = height;
		this.dom.documentElement.setAttribute('width', this.width);
		this.dom.documentElement.setAttribute('height', this.height);
	}

	_updateShapeDom(shapesLayoutInfo) {
		this.shapes.forEach((shape, index) => {
			if(shape.name === shapesLayoutInfo[index].meta) {
				shape.attr.x = shapesLayoutInfo[index].x;
				shape.attr.y = shapesLayoutInfo[index].y;
			}
			shape.dom.documentElement.setAttribute('x', shape.attr.x);
			shape.dom.documentElement.setAttribute('y', shape.attr.y);
		});
	}

	static getShapes(svgs) {
		let shapes = [];
		svgs.forEach(svg => {
			let dom = new DOMParser().parseFromString(svg.contents.toString());
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





