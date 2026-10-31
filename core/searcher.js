/**
 * 混合检索 —— 词汇打分兜底 + 可选向量（Ollama embedding）加权.
 *
 * 设计立场：embedding 是增强，不是依赖。没有 Ollama，clipbrain 依然是一台
 * 好用的剪贴板机器；有 Ollama，"三个月前复制的那个关于重试的段落"也能找回。
 *
 * 词汇分（0-1）：
 *   - 分词：连续字母数字串 + CJK 单字
 *   - 查询词命中 +1，前缀命中 +0.6，全文子串整体命中 +0.8
 *   - 归一化到 [0,1]
 * 向量分（0-1）：余弦相似度映射 (cos+1)/2
 * 合成：vector 可用时 score = 0.70*vector + 0.30*lexical——语义权重更高，
 *       让零词法重叠的语义近邻能排到弱词法命中之前；纯词法路径不降权。
 *       置顶 +0.15，新近度给微小加成（前 1 小时内线性衰减，上限 +0.1），
 *       且只加给有相关性的条目——纯时间新鲜度不制造检索结果。
 * 所有分数确定性：同样的库、同样的查询，永远同一个排序。
 */

'use strict';

const TOKEN_RE = /[a-zA-Z0-9_]+|./gu;

function tokenize(text) {
  const tokens = [];
  const matches = String(text).match(/[a-zA-Z0-9_]+|[\u2E80-\u9FFF\uAC00-\uD7AF]/g);
  if (matches) {
    for (const m of matches) {
      if (/^[a-zA-Z0-9_]+$/.test(m)) tokens.push(m.toLowerCase());
      else tokens.push(m); // CJK 单字
    }
  }
  return tokens;
}

function lexicalScore(query, text) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const tTokens = tokenize(text);
  const tSet = new Map();
  for (const t of tTokens) tSet.set(t, (tSet.get(t) || 0) + 1);

  const lowerText = text.toLowerCase();
  let score = 0;
  for (const q of qTokens) {
    if (tSet.has(q)) score += 1;
    else {
      // 前缀命中（打了一半也能找到）
      let prefix = false;
      for (const t of tSet.keys()) {
        if (t.length > q.length && t.startsWith(q)) {
          prefix = true;
          break;
        }
        if (q.length > t.length && q.startsWith(t) && t.length >= 2) {
          prefix = true;
          break;
        }
      }
      if (prefix) score += 0.6;
      else if (q.length >= 2 && lowerText.includes(q)) score += 0.8; // 子串（含跨词）
    }
  }
  const normalized = score / qTokens.length;
  // 整段子串命中（查询完整出现在文本里）给强加成
  const whole = lowerText.includes(query.trim().toLowerCase()) ? 0.25 : 0;
  return Math.min(1, normalized + whole);
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

function recencyBoost(created, now) {
  const ageMs = Math.max(0, now - created);
  const hour = 3600 * 1000;
  if (ageMs >= hour) return 0;
  return 0.1 * (1 - ageMs / hour);
}

/**
 * @param {Array<{id,text,type,created,pinned,emb?:number[]}>} items
 * @param {string} query
 * @param {{now?:number, queryEmb?:number[]|null, limit?:number}} opts
 */
function search(items, query, { now = Date.now(), queryEmb = null, limit = 50 } = {}) {
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    // 空查询 = 时间线：置顶优先，其余按时间
    return items
      .slice()
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created - a.created)
      .slice(0, limit);
  }
  const useVector = Boolean(queryEmb);
  const scored = [];
  for (const item of items) {
    const lexical = lexicalScore(trimmed, item.text);
    const hasVector = useVector && Boolean(item.emb);
    // 无关条目不进结果；语义可达的条目（向量路径活跃且有向量）保留给排序
    if (lexical <= 0 && !hasVector && !item.pinned) continue;
    let score = lexical;
    if (hasVector) {
      const v = (cosine(queryEmb, item.emb) + 1) / 2;
      score = 0.7 * v + 0.3 * lexical;
    }
    if (item.pinned) score += 0.15;
    score += recencyBoost(item.created, now);
    scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score || b.item.created - a.item.created);
  return scored.slice(0, limit).map((s) => s.item);
}

module.exports = { tokenize, lexicalScore, cosine, search, recencyBoost };
