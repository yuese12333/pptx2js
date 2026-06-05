/**
 * OOXML 专用 XML 解析器（无外部依赖）
 *
 * 节点结构：
 *   { tag: 'a:r', attrs: { 'r:id': 'rId1', w: '25400' }, children: [...], text: '' }
 *
 * 特性：
 *   - children 保留原始 XML 子节点顺序
 *   - children() 始终返回数组（消除 xml2js 单/多不一致）
 *   - 空节点（如 <a:buNone/>）返回节点对象而非 '' / null（修复 xml2js 的 falsy 陷阱）
 *   - 命名空间前缀保留，与 OOXML 原文一致
 */

/**
 * @typedef {object} OONode
 * @property {string} tag
 * @property {Record<string,string>} attrs
 * @property {OONode[]} children
 * @property {string} text
 */

/**
 * @param {string} str
 * @returns {OONode}
 */
function parseXml(str) {
  return new Parser(str).parse();
}

class Parser {
  constructor(input) {
    this.s = input;
    this.pos = 0;
  }

  parse() {
    this.skipProlog();
    return this.parseElement();
  }

  skipProlog() {
    while (this.pos < this.s.length) {
      this.skipSpaces();
      if (this.peek('<?')) {
        const end = this.s.indexOf('?>', this.pos);
        this.pos = end === -1 ? this.s.length : end + 2;
      } else if (this.peek('<!--')) {
        const end = this.s.indexOf('-->', this.pos);
        this.pos = end === -1 ? this.s.length : end + 3;
      } else {
        break;
      }
    }
  }

  parseElement() {
    this.skipSpaces();
    this.eat('<');

    const tag = this.readName();
    const rawAttrs = this.readAttributes();
    this.skipSpaces();

    // 过滤掉 xmlns 声明，暴露给调用方的 attrs 只有业务属性
    const attrs = {};
    for (const [k, v] of Object.entries(rawAttrs)) {
      if (k !== 'xmlns' && !k.startsWith('xmlns:')) {
        attrs[k] = v;
      }
    }

    /** @type {OONode} */
    const node = { tag, attrs, children: [], text: '' };

    if (this.s[this.pos] === '/') {
      this.pos += 2; // />
      return node;
    }
    this.eat('>');

    // 收集子内容
    let textBuf = '';

    const flushText = () => {
      if (textBuf) {
        // 只在没有子元素时，或文本非纯空白时记录
        // 这样格式化缩进不会污染有子节点的父元素
        const decoded = decodeEntities(textBuf);
        if (node.children.length === 0) {
          // 叶节点：保留全部文本（包括 \n，因为 <a:t>\n</a:t> 是有意义的）
          node.text += decoded;
        } else {
          // 有子节点的父元素：只保留非纯空白文本
          if (decoded.trim()) {
            node.text += decoded;
          }
        }
        textBuf = '';
      }
    };

    while (this.pos < this.s.length) {
      if (this.peek('</')) {
        flushText();
        this.pos += 2;
        this.readName();
        this.skipSpaces();
        this.eat('>');
        break;
      } else if (this.peek('<!--')) {
        const end = this.s.indexOf('-->', this.pos);
        this.pos = end === -1 ? this.s.length : end + 3;
      } else if (this.peek('<![CDATA[')) {
        const end = this.s.indexOf(']]>', this.pos);
        if (end === -1) break;
        textBuf += this.s.slice(this.pos + 9, end);
        this.pos = end + 3;
      } else if (this.s[this.pos] === '<') {
        flushText();
        node.children.push(this.parseElement());
      } else {
        // 文本字符
        textBuf += this.s[this.pos++];
      }
    }

    return node;
  }

  readName() {
    const start = this.pos;
    while (this.pos < this.s.length && /[\w\-\.:]/.test(this.s[this.pos])) {
      this.pos++;
    }
    return decodeOoxmlName(this.s.slice(start, this.pos));
  }

  readAttributes() {
    const attrs = {};
    while (this.pos < this.s.length) {
      this.skipSpaces();
      const c = this.s[this.pos];
      if (c === '>' || c === '/' || c === '?') break;

      const name = this.readName();
      if (!name) { this.pos++; continue; }

      this.skipSpaces();
      if (this.s[this.pos] !== '=') {
        attrs[name] = '';
        continue;
      }
      this.pos++; // =
      this.skipSpaces();

      const quote = this.s[this.pos];
      if (quote !== '"' && quote !== "'") {
        this.pos++;
        const start = this.pos;
        while (this.pos < this.s.length && !/[\s>]/.test(this.s[this.pos])) this.pos++;
        attrs[name] = decodeEntities(this.s.slice(start, this.pos));
        continue;
      }
      this.pos++;
      const start = this.pos;
      while (this.pos < this.s.length && this.s[this.pos] !== quote) this.pos++;
      attrs[name] = decodeEntities(this.s.slice(start, this.pos));
      this.pos++;
    }
    return attrs;
  }

  skipSpaces() {
    while (this.pos < this.s.length && /[ \t\r\n]/.test(this.s[this.pos])) this.pos++;
  }

  peek(s) {
    return this.s.startsWith(s, this.pos);
  }

  eat(ch) {
    if (this.s[this.pos] !== ch) {
      const ctx = this.s.slice(Math.max(0, this.pos - 30), this.pos + 30);
      throw new Error(`XML parse error: expected '${ch}' at pos ${this.pos}, context: ...${ctx}...`);
    }
    this.pos++;
  }
}

function decodeEntities(s) {
  return decodeOoxmlText(s);
}

/** 命名实体（单次扫描，避免链式 replace 对结果二次匹配） */
const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/**
 * 文本/属性值中的 XML 实体（不含 _xHHHH_，该序列仅用于元素名）
 * @param {string} str
 */
function decodeOoxmlText(str) {
  if (!str) return '';
  return String(str).replace(
    /&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));/g,
    (match, dec, hex, name) => {
      if (dec != null && dec !== '') {
        return String.fromCharCode(parseInt(dec, 10));
      }
      if (hex != null && hex !== '') {
        return String.fromCharCode(parseInt(hex, 16));
      }
      if (NAMED_ENTITIES[name]) return NAMED_ENTITIES[name];
      return match;
    }
  );
}

/**
 * OOXML 元素/属性名中的 _xHHHH_ 转义（不用于 a:t 文本）
 * @param {string} str
 */
function decodeOoxmlName(str) {
  if (!str) return '';
  return str.replace(/_x([0-9a-fA-F]{4})_/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

module.exports = { parseXml, decodeOoxmlText, decodeOoxmlName };