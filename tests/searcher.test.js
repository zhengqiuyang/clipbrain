/** searcher：词法打分、向量合成、空查询时间线、确定性. */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { tokenize, lexicalScore, cosine, search, recencyBoost } = require('../core/searcher');

const NOW = 1700000000000;
const HOUR = 3600 * 1000;

function items(list) {
  return list.map(([text, extra = {}], i) => ({
    id: String(i),
    text,
    type: 'text',
    created: NOW - i * 60000,
    pinned: false,
    ...extra,
  }));
}

test('tokenize：英文词与 CJK 单字', () => {
  assert.deepStrictEqual(tokenize('git rebase'), ['git', 'rebase']);
  assert.deepStrictEqual(tokenize('上下文'), ['上', '下', '文']);
  assert.deepStrictEqual(tokenize('SSH_KEY'), ['ssh_key']);
});

test('词法：命中、前缀、子串', () => {
  assert.ok(lexicalScore('rebase', 'git rebase -i HEAD~3') > 0.5);
  assert.ok(lexicalScore('reba', 'git rebase -i HEAD~3') > 0); // 前缀
  assert.ok(lexicalScore('上下文', '上下文窗口很大') > 0.5);
  assert.strictEqual(lexicalScore('zzz', 'nothing here'), 0);
});

test('空查询返回时间线（置顶优先，其余按新）', () => {
  const list = items([['a'], ['b', { pinned: true }], ['c']]);
  const out = search(list, '', { now: NOW });
  assert.strictEqual(out[0].text, 'b'); // 置顶优先
  assert.strictEqual(out[1].text, 'a');
  assert.strictEqual(out[2].text, 'c');
});

test('相关文档排序在无关之前', () => {
  const list = items([
    ['今天天气不错'],
    ['git rebase 交互式变基教程'],
    ['买菜清单：土豆 西红柿'],
  ]);
  const out = search(list, 'rebase', { now: NOW });
  assert.strictEqual(out.length, 1, '无关条目不应混入结果');
  assert.strictEqual(out[0].text, 'git rebase 交互式变基教程');
});

test('语义向量参与合成', () => {
  const a = [1, 0];
  const b = [0.9, 0.1];
  const c = [0, 1];
  const list = items([
    ['apple doc', { emb: a }],
    ['banana doc', { emb: b }],
    ['car doc', { emb: c }],
  ]);
  const out = search(list, 'apple', { now: NOW, queryEmb: a });
  assert.strictEqual(out[0].text, 'apple doc');
  // 语义上相近的 banana 应该排在与查询词无词法重叠的 car 之前
  assert.ok(
    out.findIndex((x) => x.text === 'banana doc') <
    out.findIndex((x) => x.text === 'car doc')
  );
});

test('cosine 相同向量=1，正交=0', () => {
  assert.ok(Math.abs(cosine([1, 0], [1, 0]) - 1) < 1e-9);
  assert.ok(Math.abs(cosine([1, 0], [0, 1])) < 1e-9);
});

test('置顶与新鲜度加成', () => {
  assert.ok(recencyBoost(NOW - 60000, NOW) > 0);
  assert.strictEqual(recencyBoost(NOW - 2 * HOUR, NOW), 0);
  const list = items([
    ['target old'],
    ['unrelated fresh', { created: NOW - 30000 }],
  ]);
  list[0].created = NOW - 5 * HOUR;
  list[0].pinned = true;
  const out = search(list, 'target', { now: NOW });
  assert.strictEqual(out[0].text, 'target old');
});

test('确定性：同库同查询同排序', () => {
  const list = items(['x1', 'x2', 'x3']);
  const a = search(list, 'x', { now: NOW });
  const b = search(list, 'x', { now: NOW });
  assert.deepStrictEqual(a.map((i) => i.id), b.map((i) => i.id));
});

test('limit 截断', () => {
  const list = items(['a1', 'a2', 'a3', 'a4']);
  assert.strictEqual(search(list, 'a', { now: NOW, limit: 2 }).length, 2);
});
