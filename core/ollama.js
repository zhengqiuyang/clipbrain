/**
 * Ollama embedding 客户端 —— 纯 Node http，完全可选.
 *
 * 约定：不可用就是不可用，探测一次缓存结论，绝不阻塞捕获路径。
 * embedding 只在捕获后台补算与查询时使用。
 */

'use strict';

const http = require('http');

const DEFAULT_HOST = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'nomic-embed-text';

function embed(host, model, text, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ model, prompt: text });
    const req = http.request(
      `${host}/api/embeddings`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: timeoutMs },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const emb = parsed && parsed.embedding;
            if (Array.isArray(emb) && emb.length) resolve(emb);
            else resolve(null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
    req.end(body);
  });
}

/** 探测服务是否可用（缓存正反结论，失败方 60s 后才重试）. */
function createProbe(host = DEFAULT_HOST, model = DEFAULT_MODEL) {
  let available = null; // null = 未知
  let lastFail = 0;
  return async function probe() {
    if (available === true) return true;
    if (available === false && Date.now() - lastFail < 60000) return false;
    const result = await embed(host, model, 'ping', 1500);
    available = Boolean(result);
    if (!available) lastFail = Date.now();
    return available;
  };
}

module.exports = { embed, createProbe, DEFAULT_HOST, DEFAULT_MODEL };
