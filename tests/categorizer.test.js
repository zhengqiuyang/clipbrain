/** categorizer：确定性分类. */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { categorize, preview } = require('../core/categorizer');

test('URL 单行识别', () => {
  assert.strictEqual(categorize('https://github.com/zhengqiuyang'), 'url');
  assert.strictEqual(categorize('http://a.b/c?d=1'), 'url');
});

test('颜色识别', () => {
  assert.strictEqual(categorize('#4fc1ff'), 'color');
  assert.strictEqual(categorize('rgb(79, 193, 255)'), 'color');
});

test('数字验证码', () => {
  assert.strictEqual(categorize('482913'), 'otp');
  assert.strictEqual(categorize('123'), 'text'); // 太短不算
});

test('JSON 可解析才算', () => {
  assert.strictEqual(categorize('{"a":1}'), 'json');
  assert.strictEqual(categorize('{不是json}'), 'text');
});

test('命令行识别', () => {
  assert.strictEqual(categorize('git rebase -i HEAD~3'), 'command');
  assert.strictEqual(categorize('npm install -g pnpm'), 'command');
  assert.strictEqual(categorize('docker ps -a'), 'command');
});

test('多行代码识别', () => {
  const code = 'def fix(x):\n    return x * 2\nprint(fix(21))';
  assert.strictEqual(categorize(code), 'code');
  const js = 'const x = 1;\nconst y = 2;\nreturn x + y;';
  assert.strictEqual(categorize(js), 'code');
});

test('普通文本兜底', () => {
  assert.strictEqual(categorize('上下文窗口是模型一次能读到的全部内容'), 'text');
  assert.strictEqual(categorize(''), 'text');
});

test('preview 压平空白并截断', () => {
  assert.strictEqual(preview('a\n  b\tc'), 'a b c');
  assert.strictEqual(preview('x'.repeat(200), 10).length, 10);
  assert.ok(preview('x'.repeat(200), 10).endsWith('…'));
});
