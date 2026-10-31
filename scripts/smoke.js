/**
 * 无 Electron 冒烟：分类 → 存储 → 检索 全链路走一遍真实数据.
 * exit 0 通过 / 1 失败。CI 与本地共用.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { categorize } = require('../core/categorizer');
const { ClipboardStore } = require('../core/store');
const { search } = require('../core/searcher');

function main() {
  const samples = [
    ['git rebase -i HEAD~3', 'command'],
    ['https://github.com/zhengqiuyang', 'url'],
    ['{"name":"clipbrain","version":"0.1.0"}', 'json'],
    ['#4fc1ff', 'color'],
    ['482913', 'otp'],
    ['上下文窗口是模型一次能读到的全部内容，满了就会被压缩', 'text'],
  ];

  for (const [text, expect] of samples) {
    const got = categorize(text);
    if (got !== expect) {
      console.error(`SMOKE FAIL: categorize(${JSON.stringify(text.slice(0, 30))}) = ${got}, 期望 ${expect}`);
      process.exit(1);
    }
  }

  const file = path.join(os.tmpdir(), `clipbrain-smoke-${process.pid}.json`);
  const store = new ClipboardStore(file, { now: () => Date.now() });
  for (const [text] of samples) store.capture(text, categorize(text));
  if (store.size() !== samples.length) {
    console.error('SMOKE FAIL: 捕获数量不对');
    process.exit(1);
  }
  store.dispose();

  const reloaded = new ClipboardStore(file);
  if (reloaded.size() !== samples.length) {
    console.error('SMOKE FAIL: 落盘重载数量不对');
    process.exit(1);
  }
  const hits = search(reloaded.all(), '上下文 窗口', { now: Date.now() });
  if (!hits.length || !hits[0].text.includes('上下文窗口')) {
    console.error('SMOKE FAIL: 中文检索未命中');
    process.exit(1);
  }
  fs.unlinkSync(file);
  console.log(`SMOKE OK items=${reloaded.size()} 中文检索命中`);
}

main();
