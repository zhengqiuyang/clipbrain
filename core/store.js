/**
 * 剪贴板历史存储 —— JSON 文件 + 内存索引，零原生模块.
 *
 * 为什么不是 SQLite：better-sqlite3 这类原生模块在 Electron 下要对着
 * Electron 头文件重编译（需要 MSVC 构建链），违背"clone 即用"的纪律。
 * 一万条文本历史的量级下，JSON + 内存索引绰绰有余：
 *   - 追加 O(1)，去重 O(1)（首行哈希 Map）
 *   - 检索在 searcher 里做（全内存扫描，万条 < 5ms）
 * 写盘策略：变更即标记 dirty，300ms 防抖落盘；退出时强制 flush。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_ITEMS = 5000;
const DEBOUNCE_MS = 300;

class ClipboardStore {
  constructor(filePath, { maxItems = DEFAULT_MAX_ITEMS, now = () => Date.now() } = {}) {
    this.filePath = filePath;
    this.maxItems = maxItems;
    this.now = now;
    this.items = [];            // 新的在前
    this.byText = new Map();    // text -> item（O(1) 去重/提升）
    this.dirty = false;
    this.timer = null;
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item && typeof item.text === 'string') this.items.push(item);
        }
      }
    } catch {
      /* 首次启动或文件损坏：从空开始（损坏的剪贴板历史不值得救） */
    }
    for (const item of this.items) this.byText.set(item.text, item);
  }

  /** 捕获一条文本。重复内容提升到顶部并更新时间；返回变动后的条目或 null. */
  capture(text, type) {
    if (typeof text !== 'string' || !text.trim()) return null;
    const existing = this.byText.get(text);
    if (existing) {
      existing.created = this.now();
      this._moveToTop(existing);
      this.dirty = true;
      this._scheduleFlush();
      return existing;
    }
    const item = {
      id: `${this.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      type,
      created: this.now(),
      pinned: false,
    };
    this.items.unshift(item);
    this.byText.set(text, item);
    this._trim();
    this.dirty = true;
    this._scheduleFlush();
    return item;
  }

  _moveToTop(item) {
    const i = this.items.indexOf(item);
    if (i > 0) {
      this.items.splice(i, 1);
      this.items.unshift(item);
    }
  }

  _trim() {
    if (this.items.length <= this.maxItems) return;
    // 容量是硬上限：置顶优先保留，其余按新到旧；相对顺序保持时间序
    const sorted = [...this.items].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.created - a.created
    );
    const keep = new Set(sorted.slice(0, this.maxItems));
    this.items = this.items.filter((i) => keep.has(i));
    this.byText = new Map(this.items.map((i) => [i.text, i]));
  }

  pin(id, value = true) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return null;
    item.pinned = Boolean(value);
    this.dirty = true;
    this._scheduleFlush();
    return item;
  }

  remove(id) {
    const i = this.items.findIndex((x) => x.id === id);
    if (i === -1) return false;
    const [item] = this.items.splice(i, 1);
    this.byText.delete(item.text);
    this.dirty = true;
    this._scheduleFlush();
    return true;
  }

  all() {
    return this.items;
  }

  size() {
    return this.items.length;
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) return;
    const payload = JSON.stringify({ version: 1, items: this.items });
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, payload, 'utf8');
    fs.renameSync(tmp, this.filePath);
    this.dirty = false;
  }

  _scheduleFlush() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        this.flush();
      } catch {
        /* 落盘失败不打断捕获，下次再试 */
      }
    }, DEBOUNCE_MS);
    if (this.timer.unref) this.timer.unref();
  }

  dispose() {
    this.flush();
  }
}

module.exports = { ClipboardStore, DEFAULT_MAX_ITEMS };
