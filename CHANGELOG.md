# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- 图片/文件剪贴板捕获（v1 仅文本）
- 置顶管理视图与标签
- 多设备同步（端到端加密，可选）
- 敏感窗口黑名单（密码管理器中不捕获）

## [0.1.0] — 2026-10-31

### Added

- **捕获**：800ms 轮询剪贴板，重复内容自动提升到顶部并刷新时间；
  从面板复制走的内容不回捕（`suppressNextCapture`）。
- **分类**：确定性启发式七类——链接 / 颜色 / 命令 / 代码 / JSON / 数字码 /
  文本；徽章着色，同一输入永远同一类型。
- **检索**：词法打分兜底（词命中 / 前缀 / 全文子串 + 置顶 + 新鲜度），
  Ollama embedding 可用时自动升级语义检索（余弦 0.70 / 词法 0.30 合成，
  零词法重叠的语义近邻也能被找回），面板实时显示当前模式（词法/语义）。
- **面板**：无边框暗色面板，全局快捷键唤起（默认 `Alt+Shift+V`），
  失焦自动隐藏；↑↓ 选择、Enter 复制、Esc 隐藏、Ctrl+P 置顶、Ctrl+D 删除；
  外链类内容复制即用。
- **存储**：JSON 文件 + 内存索引（零原生模块），300ms 防抖原子落盘，
  容量上限淘汰但置顶豁免，损坏文件从空开始不崩溃。
- **embedding 客户端**：纯 Node http，探测一次缓存结论，失败 60s 后重试，
  绝不阻塞捕获路径。
- **CI**：ubuntu / windows / macOS × Node 20 / 22，
  单元测试（categorizer / store / searcher 共 30+ 用例）+ 全链路冒烟。
- Electron 冒烟通道 `--smoke`：存储→分类→检索闭环自检后退出。

### Design invariants

- 零原生模块：better-sqlite3 这类需要对 Electron 重编译的依赖坚决不进——
  clone、`npm install`、`npm start`，三行跑起来。
- embedding 是增强不是依赖：没有 Ollama，clipbrain 依然是一台好用的剪贴板机器。
- 检索确定性：同样的库、同样的查询，永远同一个排序。
- 数据不出机：存储在 userData 的两个 JSON 文件里，无网络上报。
