class CSS {

	constructor(shapes, opt) {

		// shape info
		this.shapes = shapes;

		// css selector info
		this.nameSpace = opt.nameSpace;
		this.block = opt.block;
		this.separator = opt.separator;

		// rule info
		this.rulesInfo = [];
		this.commonRuleInfo = {
			className: '.' + opt.nameSpace + opt.separator + this.block,
			attr: {
				'background': 'url("' + opt.spriteRelative + '") left top no-repeat',
				'display': 'inline-block',
				'overflow': 'hidden',
				'font-size': '0',
				'line-height': '0',
				'vertical-align': 'top'
			}
		};

		this._init();
	}

	getCss() {
		let commonCssRule = CSS._makeCssRule(this.commonRuleInfo);
		let shapesCssRule = this._makeShapesCssRule();
		return commonCssRule + shapesCssRule;
	}

	_init() {
		this._getRulesInfo();
	}

	_getRulesInfo() {
		this.shapes.forEach(shape => {
			this.rulesInfo.push(this._getRuleInfoByShape(shape));
		});
	}

	_getRuleInfoByShape(shape) {
		let positionX = 0;
		if (shape.attr.x !== 0) {
			positionX = '-' + shape.attr.x + 'px';
		}

		let positionY = 0;
		if (shape.attr.y !== 0) {
			positionY = '-' + shape.attr.y + 'px';
		}

		return {
			className: '.' + this.nameSpace + this.separator + this.block + this.separator + shape.name,
			attr: {
				'width': shape.attr.width + 'px',
				'height': shape.attr.height + 'px',
				'background-position': positionX + ' ' + positionY
			}
		};
	}

	_makeShapesCssRule() {
		let rules = [];
		this.rulesInfo.forEach(ruleInfo => {
			rules.push(CSS._makeCssRule(ruleInfo));
		});
		return rules.join('');
	}

	static _makeCssRule(ruleInfo) {
		let content = '';
		for (let prop in ruleInfo.attr ) {
			content += CSS._makeCssDecl(prop, ruleInfo.attr[prop]);
		}
		return ruleInfo.className + ' {' + content + '\n}\n\n';
	}

	static _makeCssDecl(prop, value) {
		return '\n    ' + prop.trim() + ': ' + value.trim() + ';';
	}

}

module.exports = CSS;


