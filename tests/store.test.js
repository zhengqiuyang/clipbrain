/** store：捕获/去重/置顶/淘汰/落盘. */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ClipboardStore } = require('../core/store');

function tmpfile() {
  return path.join(os.tmpdir(), `clipbrain-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

const FIXED_NOW = 1700000000000;

function newStore(file, opts = {}) {
  return new ClipboardStore(file, { now: () => FIXED_NOW, ...opts });
}

test('捕获与去重提升', () => {
  const s = newStore(tmpfile());
  s.capture('a');
  s.capture('b');
  s.capture('a');
  assert.strictEqual(s.size(), 2);
  assert.strictEqual(s.all()[0].text, 'a'); // 重复的被提升到顶部
});

test('空文本与纯空白不捕获', () => {
  const s = newStore(tmpfile());
  assert.strictEqual(s.capture(''), null);
  assert.strictEqual(s.capture('   \n '), null);
  assert.strictEqual(s.size(), 0);
});

test('pin 置顶且淘汰时豁免', () => {
  const s = newStore(tmpfile(), { maxItems: 3 });
  s.capture('1');
  s.capture('2');
  s.capture('3');
  s.pin(s.all()[2].id, true); // '1' 置顶（最旧）
  s.capture('4');
  s.capture('5');
  // 容量 3：'1' 置顶豁免，最新的留下，中间被淘汰
  const texts = s.all().map((i) => i.text);
  assert.ok(texts.includes('1'), '置顶不淘汰');
  assert.ok(texts.includes('5'));
  assert.strictEqual(s.size(), 3);
});

test('remove 删除', () => {
  const s = newStore(tmpfile());
  const item = s.capture('x');
  assert.ok(s.remove(item.id));
  assert.strictEqual(s.size(), 0);
  assert.ok(!s.remove('nope'));
});

test('flush 落盘并重新载入', () => {
  const file = tmpfile();
  const s = newStore(file);
  s.capture('hello world');
  s.capture('second');
  s.dispose();
  const s2 = newStore(file);
  assert.strictEqual(s2.size(), 2);
  assert.strictEqual(s2.all()[0].text, 'second'); // 顺序保留
  s2.dispose();
  fs.unlinkSync(file);
});

test('损坏文件从空开始不崩溃', () => {
  const file = tmpfile();
  fs.writeFileSync(file, '{not json', 'utf8');
  const s = newStore(file);
  assert.strictEqual(s.size(), 0);
  fs.unlinkSync(file);
});

test('捕获即时返回条目，type 由调用方传入', () => {
  const s = newStore(tmpfile());
  const item = s.capture('git status', 'command');
  assert.strictEqual(item.type, 'command');
  assert.ok(item.id);
  s.dispose();
});
