/**
 * 内容分类器 —— 确定性启发式，同一输入永远同一类型.
 *
 * 类型即检索体验的一半：命令、链接、代码、JSON、颜色、数字码、普通文本，
 * 徽章不同，搜索权重和展示方式也不同。
 */

'use strict';

const URL_RE = /^https?:\/\/\S+$/i;
const COLOR_RE = /^(#[0-9a-f]{3,8}\b|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3})/i;
const CODE_HINTS = [
  /function\s+\w+\s*\(/,
  /(?:const|let|var|def|class|import|export|require|return)\s/,
  /=>\s*\{?/,
  /<\/?[a-z][a-z0-9-]*>/,
  /[;{}]\s*$/m,
  /^\s*(?:git|npm|pip|docker|curl|ssh|cd|ls|mkdir|rm|python|node|cargo|make)\s+\S+/m,
];
const COMMAND_RE = /^\s*(?:git|npm|npx|pip|pip3|docker|curl|wget|ssh|scp|cd|ls|ll|mkdir|touch|rm|mv|cp|cat|grep|find|python|python3|node|cargo|make|kubectl|ffmpeg|code|winget|brew|choco|scoop)\b[^\n]*$/;
const DIGITS_RE = /^\d{4,8}$/;

/**
 * @param {string} text
 * @returns {'url'|'color'|'command'|'code'|'json'|'otp'|'text'}
 */
function categorize(text) {
  if (typeof text !== 'string' || !text.trim()) return 'text';
  const trimmed = text.trim();

  if (URL_RE.test(trimmed) && !trimmed.includes('\n')) return 'url';
  if (trimmed.length <= 32 && COLOR_RE.test(trimmed)) return 'color';
  if (trimmed.length <= 12 && DIGITS_RE.test(trimmed)) return 'otp';

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      /* 不是 JSON，继续 */
    }
  }

  if (!trimmed.includes('\n') && COMMAND_RE.test(trimmed)) return 'command';

  const hints = CODE_HINTS.reduce((n, re) => n + (re.test(trimmed) ? 1 : 0), 0);
  const multiline = trimmed.includes('\n');
  if (hints >= 2 || (multiline && hints >= 1)) return 'code';

  return 'text';
}

const TYPE_LABELS = {
  url: '链接',
  color: '颜色',
  command: '命令',
  code: '代码',
  json: 'JSON',
  otp: '数字码',
  text: '文本',
};

/** 展示用预览：压平空白、截断，类型相关的特判留给渲染层. */
function preview(text, limit = 160) {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > limit ? flat.slice(0, limit - 1) + '…' : flat;
}

module.exports = { categorize, TYPE_LABELS, preview };
