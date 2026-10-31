/**
 * clipbrain —— Electron 主进程.
 *
 * 生命周期：单实例 → 载入存储 → 捕获循环（800ms 轮询剪贴板）→
 * 全局快捷键唤起无边框面板 → 失焦自动隐藏 → 退出时落盘.
 *
 * `--smoke`：跑完存储/分类/检索自检后退出码 0/1，不开窗口不注册快捷键.
 */

'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const { categorize, preview } = require('./core/categorizer');
const { ClipboardStore } = require('./core/store');
const { search } = require('./core/searcher');
const { embed, createProbe, DEFAULT_HOST, DEFAULT_MODEL } = require('./core/ollama');

const SMOKE = process.argv.includes('--smoke');
const CAPTURE_INTERVAL_MS = 800;
const STORE_VERSION = 1;

// ---------------- settings ----------------

function loadSettings() {
  const file = path.join(app.getPath('userData'), 'settings.json');
  let stored = {};
  try {
    stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* 默认值即可 */
  }
  return {
    hotkey: stored.hotkey || 'Alt+Shift+V',
    maxItems: Number(stored.maxItems) || 5000,
    ollama: {
      enabled: stored.ollama ? stored.ollama.enabled !== false : true,
      host: (stored.ollama && stored.ollama.host) || DEFAULT_HOST,
      model: (stored.ollama && stored.ollama.model) || DEFAULT_MODEL,
    },
    file,
  };
}

// ---------------- app state ----------------

let settings;
let store;
let mainWindow = null;
let captureTimer = null;
let lastClipboardText = null;
let suppressNextCapture = false; // 从面板复制走的内容不再回捕
let probe;
let quitting = false;

function captureOnce() {
  const text = clipboard.readText();
  if (!text || !text.trim()) return;
  if (text === lastClipboardText) return;
  if (suppressNextCapture) {
    suppressNextCapture = false;
    lastClipboardText = text;
    return;
  }
  lastClipboardText = text;
  const type = categorize(text);
  const item = store.capture(text, type);
  if (item) {
    // 后台补算 embedding（尽力而为，失败不影响任何东西）
    if (settings.ollama.enabled && probe && probe() && item.text.length <= 4000) {
      embed(settings.ollama.host, settings.ollama.model, item.text).then((emb) => {
        if (emb) {
          item.emb = emb;
          store.flush();
        }
      });
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('clipbrain:changed');
    }
  }
}

function startCapture() {
  if (captureTimer) return;
  captureTimer = setInterval(captureOnce, CAPTURE_INTERVAL_MS);
}

function stopCapture() {
  if (captureTimer) clearInterval(captureTimer);
  captureTimer = null;
}

function togglePanel() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }
  // 出现在主屏上方三分之一处——离手最近的位置
  const { workArea } = screen.getPrimaryDisplay();
  const [w] = mainWindow.getSize();
  const x = Math.round(workArea.x + (workArea.width - w) / 2);
  const y = Math.round(workArea.y + workArea.height * 0.12);
  mainWindow.setPosition(x, y);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('clipbrain:shown');
}

// ---------------- IPC ----------------

function renderView(item) {
  return {
    id: item.id,
    text: item.text,
    preview: preview(item.text),
    type: item.type,
    created: item.created,
    pinned: item.pinned,
    semantic: Boolean(item.emb),
  };
}

function wireIpc() {
  ipcMain.handle('clipbrain:query', async (_evt, query) => {
    let queryEmb = null;
    if (settings.ollama.enabled && query && query.trim() && probe && (await probe())) {
      queryEmb = await embed(settings.ollama.host, settings.ollama.model, query);
    }
    const results = search(store.all(), query || '', {
      queryEmb,
      limit: 80,
    });
    return {
      semantic: Boolean(queryEmb),
      items: results.map(renderView),
    };
  });

  ipcMain.handle('clipbrain:copy', (_evt, id) => {
    const item = store.all().find((x) => x.id === id);
    if (!item) return false;
    clipboard.writeText(item.text);
    suppressNextCapture = true;
    lastClipboardText = item.text;
    return true;
  });

  ipcMain.handle('clipbrain:pin', (_evt, { id, value }) => {
    store.pin(id, value);
    return true;
  });

  ipcMain.handle('clipbrain:remove', (_evt, id) => store.remove(id));

  ipcMain.handle('clipbrain:hide', () => {
    if (mainWindow) mainWindow.hide();
    return true;
  });

  ipcMain.handle('clipbrain:settings', () => ({
    hotkey: settings.hotkey,
    ollama: { enabled: settings.ollama.enabled, model: settings.ollama.model },
  }));
}

// ---------------- window ----------------

function createPanel() {
  mainWindow = new BrowserWindow({
    width: 640,
    height: 680,
    frame: false,
    show: false,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#0b0e14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.loadFile(path.join(__dirname, 'panel', 'panel.html'));
  mainWindow.on('blur', () => {
    if (mainWindow && mainWindow.isVisible()) mainWindow.hide();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------- bootstrap ----------------

app.requestSingleInstanceLock();
app.on('second-instance', () => togglePanel());

app.whenReady().then(async () => {
  settings = loadSettings();
  store = new ClipboardStore(path.join(app.getPath('userData'), 'history.json'), {
    maxItems: settings.maxItems,
  });
  probe = createProbe(settings.ollama.host, settings.ollama.model);

  if (SMOKE) {
    const ok = runSelfCheck();
    console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
    app.exit(ok ? 0 : 1);
    return;
  }

  wireIpc();
  createPanel();
  startCapture();
  const ok = globalShortcut.register(settings.hotkey, togglePanel);
  if (!ok) {
    console.warn(`[clipbrain] 全局快捷键 ${settings.hotkey} 注册失败，可能被占用`);
  }
});

function runSelfCheck() {
  // 存储 → 分类 → 检索 的最小闭环自检
  const tmp = path.join(app.getPath('temp'), `clipbrain-smoke-${Date.now()}.json`);
  const s = new ClipboardStore(tmp, { now: () => 1700000000000 });
  s.capture('git rebase -i HEAD~3', 'command');
  s.capture('https://github.com/zhengqiuyang', 'url');
  s.capture('上下文窗口是模型一次能读到的全部内容', 'text');
  if (s.size() !== 3) return false;
  const hits = search(s.all(), 'rebase');
  if (!hits.length || hits[0].type !== 'command') return false;
  const zh = search(s.all(), '上下文');
  if (!zh.length) return false;
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  return true;
}

app.on('before-quit', () => {
  quitting = true;
  stopCapture();
  if (store) store.dispose();
  if (!SMOKE) globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
  if (!quitting) quitting = true;
});

app.on('window-all-closed', () => {
  app.quit();
});

module.exports = { STORE_VERSION };
