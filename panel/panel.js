/** 面板逻辑：查询 → 渲染 → 键盘导航 → 动作（复制/置顶/删除）. */

'use strict';

const TYPE_LABELS = {
  url: '链接', color: '颜色', command: '命令',
  code: '代码', json: 'JSON', otp: '数字码', text: '文本',
};

const state = {
  items: [],
  active: 0,
  query: '',
  debounce: null,
};

const $search = document.getElementById('search');
const $list = document.getElementById('list');
const $count = document.getElementById('count');
const $mode = document.getElementById('mode');

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

function render() {
  $list.textContent = '';
  if (!state.items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = state.query
      ? '没有匹配的剪贴板内容'
      : '剪贴板还是空的——去随便复制点什么，8 毫秒后它会出现在这里';
    $list.appendChild(empty);
    $count.textContent = '0 条';
    return;
  }
  state.active = Math.min(state.active, state.items.length - 1);
  state.items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = `row ${item.type}${i === state.active ? ' active' : ''}${item.pinned ? ' pinned' : ''}`;
    row.dataset.id = item.id;

    const badge = document.createElement('span');
    badge.className = 't';
    badge.textContent = TYPE_LABELS[item.type] || item.type;

    const body = document.createElement('div');
    body.className = 'body';
    const prev = document.createElement('div');
    prev.className = 'preview';
    prev.textContent = (item.pinned ? '📌 ' : '') + item.preview;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = timeAgo(item.created) + (item.semantic ? ' · 语义' : '');
    body.appendChild(prev);
    body.appendChild(meta);

    row.appendChild(badge);
    row.appendChild(body);
    row.addEventListener('click', () => void activate(item));
    row.addEventListener('mousemove', () => {
      if (state.active !== i) {
        state.active = i;
        paintActive();
      }
    });
    $list.appendChild(row);
  });
  $count.textContent = `${state.items.length} 条`;
  ensureVisible();
}

function paintActive() {
  const rows = $list.querySelectorAll('.row');
  rows.forEach((r, i) => r.classList.toggle('active', i === state.active));
  ensureVisible();
}

function ensureVisible() {
  const row = $list.querySelectorAll('.row')[state.active];
  if (row) row.scrollIntoView({ block: 'nearest' });
}

async function refresh() {
  const data = await window.clipbrain.query(state.query);
  state.items = data.items;
  $mode.textContent = data.semantic ? '语义' : '词法';
  $mode.title = data.semantic
    ? 'Ollama 向量检索已生效'
    : '词法检索（安装 Ollama + nomic-embed-text 后自动升级语义检索）';
  state.active = 0;
  render();
}

async function activate(item) {
  await window.clipbrain.copy(item.id);
  await window.clipbrain.hide();
}

$search.addEventListener('input', () => {
  state.query = $search.value;
  clearTimeout(state.debounce);
  state.debounce = setTimeout(refresh, 120);
});

document.addEventListener('keydown', (evt) => {
  if (evt.key === 'Escape') {
    void window.clipbrain.hide();
    return;
  }
  if (evt.key === 'ArrowDown') {
    evt.preventDefault();
    if (state.items.length) {
      state.active = Math.min(state.active + 1, state.items.length - 1);
      paintActive();
    }
    return;
  }
  if (evt.key === 'ArrowUp') {
    evt.preventDefault();
    if (state.items.length) {
      state.active = Math.max(state.active - 1, 0);
      paintActive();
    }
    return;
  }
  if (evt.key === 'Enter' && state.items[state.active]) {
    void activate(state.items[state.active]);
    return;
  }
  // Ctrl+P 置顶切换；Ctrl+D 删除（不抢系统剪贴板）
  if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'p' && state.items[state.active]) {
    evt.preventDefault();
    const item = state.items[state.active];
    void window.clipbrain.pin(item.id, !item.pinned).then(refresh);
  }
  if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'd' && state.items[state.active]) {
    evt.preventDefault();
    const item = state.items[state.active];
    void window.clipbrain.remove(item.id).then(refresh);
  }
});

// 失焦由主进程收窗；这里监听主进程的"面板出现"信号来刷新与归零
window.clipbrain.onShown(() => {
  $search.value = '';
  state.query = '';
  state.active = 0;
  void refresh();
  $search.focus();
});

// 剪贴板有新内容时轻量刷新（不打断输入）
window.clipbrain.onChanged(() => {
  if (!state.query) void refresh();
});

void refresh();
