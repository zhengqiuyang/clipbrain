# clipbrain

**AI 剪贴板大脑 — 你复制过的一切，语义可搜。**

[English](README.md) | 简体中文

> 全局快捷键唤起 · 本地 embedding（可选）· 零原生模块 · 数据不出机

[![CI](https://github.com/zhengqiuyang/clipbrain/actions/workflows/ci.yml/badge.svg)](https://github.com/zhengqiuyang/clipbrain/actions/workflows/ci.yml)
[![License: MIT](https://github.com/zhengqiuyang/clipbrain/blob/main/LICENSE)](LICENSE)
![Node](https://img.shields.io/badge/Node-18%2B-green)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

---

## 你每天复制几百次，然后全忘了

一条 SSH 命令、一段报错、一个链接、一串验证码、一段写了一半的话——复制的那一刻你笃定自己记得，三天后它沉进了无底的剪贴板。

clipbrain 接住这一切。按 `Alt+Shift+V`，一个暗色面板从屏幕上方落下：

```text
┌─ clip brain ─────────────────────── ↑↓ 选择 · Enter 复制 ─┐
│ 搜索你复制过的一切…                              [语义]  │
├──────────────────────────────────────────────────────────┤
│ 命令 │ git rebase -i HEAD~3                    3 分钟前  │
│ 链接 │ https://github.com/zhengqiuyang         1 小时前  │
│ 代码 │ const brain = require('./brain')        2 小时前  │
│ 文本 │ 上下文窗口是模型一次能读到的全部内容     昨天      │
└──────────────────────────────────────────────────────────┘
```

- **七类内容自动分类**：命令 / 链接 / 代码 / JSON / 颜色 / 数字码 / 文本，徽章着色
- **语义检索**：装了 [Ollama](https://ollama.com) 自动升级——"那个关于重试的命令"也能搜到；没装则是干净的词法检索，面板右上角徽章实时告诉你当前模式
- **键盘流**：↑↓ 选择，Enter 复制并收起，Esc 隐藏，Ctrl+P 置顶，Ctrl+D 删除
- **本地优先**：历史存在 userData 的两个 JSON 文件里，无网络上报；剪贴板是机器上最敏感的地方，它哪儿也不去

## 快速开始

```bash
git clone https://github.com/zhengqiuyang/clipbrain
cd clipbrain
npm install
npm start
```

按 `Alt+Shift+V` 唤起。复制任何东西试试——800ms 内它会出现在时间线里。

开启语义检索（可选）：

```bash
ollama pull nomic-embed-text
# 重启 clipbrain，面板徽章从「词法」变「语义」
```

## 工作原理

```text
剪贴板 ──800ms 轮询──▶ 去重/提升 ──▶ 分类器（确定性七类）
                                        │
                                        ▼
                      JSON 存储（userData，防抖原子落盘）
                                        │
全局快捷键 ──▶ 无边框面板 ──▶ 混合检索 ◀┘
                              词法 0.30 + 余弦 0.70（可选 Ollama）
                              └ 没有它？纯词法，一样能用
```

设计立场：**embedding 是增强，不是依赖**。Ollama 不可用时捕获、检索、置顶、删除全部照常，只是徽章从「语义」变回「词法」。

## 诚实声明

- **v1 只捕获文本**。图片/文件剪贴板在路线图上。
- **历史无加密**。存储在你本机 userData，进程级保护即操作系统用户边界；如需磁盘加密请配合 BitLocker/FileVault。敏感窗口黑名单在路线图上。
- **检索确定性**：同样的库、同样的查询，永远同一个排序——有测试锁着。
- **无遥测、无网络上报**。唯一的网络调用是向本机 Ollama（如果你开了）。

## 验证

每条承诺都有自动化验证（`node --test`，24 用例）：

| 承诺 | 验证 |
|---|---|
| 分类器确定性 | URL/颜色/命令/代码/JSON/OTP/文本各一组边界用例 |
| 存储去重与提升 | 重复捕获不增条目、提升到顶部 |
| 置顶豁免淘汰 | 容量硬上限下置顶优先保留 |
| 损坏文件不崩溃 | 手写坏 JSON → 从空开始 |
| 无关条目不混入检索 | 纯时间新鲜度不制造结果（测试抓出过这个真 bug） |
| 语义近邻可被找回 | 零词法重叠的向量近邻排在弱词法命中之前 |
| 检索确定性 | 同库同查询同排序 |
| 全链路 | `npm run smoke:pipeline`：捕获→分类→落盘→重载→中文检索 |
| 桌面壳 | `npm run smoke`：Electron 自检闭环，实测退出码 0 |

CI：ubuntu / windows / macOS × Node 20 / 22。

## 配置

`userData/settings.json`（不存在则用默认值）：

```json
{
  "hotkey": "Alt+Shift+V",
  "maxItems": 5000,
  "ollama": { "enabled": true, "host": "http://127.0.0.1:11434", "model": "nomic-embed-text" }
}
```

## 路线图

- [ ] 图片/文件剪贴板（缩略图 + 视觉 embedding）
- [ ] 敏感窗口黑名单（密码管理器中暂停捕获）
- [ ] 置顶管理视图与标签
- [ ] 打包发布（nsis/dmg/AppImage）

## 设计原则

1. **embedding 是增强不是依赖** — 没有 Ollama 一样是一台好用的剪贴板机器。
2. **零原生模块** — clone、`npm install`、`npm start`，三行跑起来。
3. **检索确定性** — 排序可测试、可复现、可信任。
4. **数据不出机** — 剪贴板是机器上最敏感的地方。

## 许可

[MIT](LICENSE)
