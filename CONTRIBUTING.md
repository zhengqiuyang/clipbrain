# Contributing to clipbrain

剪贴板是机器上最敏感的地方之一。这些纪律让 clipbrain 配得上被信任。

## 四条边界

1. **检索确定性**。同样的库、同样的查询，必须永远同一个排序。
   searcher 的任何改动都要有 `node --test` 用例锁住排序行为。
2. **零原生模块**。不接受需要对 Electron 重编译的依赖（better-sqlite3 等）。
   存储走 JSON + 内存索引；一万条文本的量级下它够用且有测试。
3. **embedding 是增强不是依赖**。Ollama 不可用时所有功能必须照常工作，
   只是面板徽章从「语义」变回「词法」。不许让捕获路径等待网络。
4. **捕获不打扰**。捕获循环里禁止任何可能抛到未捕获异常的调用；
   从面板复制走的内容不回捕——用户刚拿走的东西不该立刻变成一条历史。

## 本地开发

```bash
git clone https://github.com/zhengqiuyang/clipbrain
cd clipbrain
npm install
npm test              # node --test：分类 / 存储 / 检索
npm run smoke:pipeline # 全链路冒烟（无 Electron）
npm start             # 打开面板（Alt+Shift+V 唤起）
npm run smoke         # Electron 冒烟自检
```

## 语义检索（可选）

装 [Ollama](https://ollama.com) 后：`ollama pull nomic-embed-text`，
重启 clipbrain，面板右上角徽章从「词法」变「语义」。

## 报 bug

附：操作系统、复现步骤、`npm run smoke:pipeline` 输出。检索排序问题
请附上"期望第一的条目"与"实际第一的条目"的文本（可脱敏）。
