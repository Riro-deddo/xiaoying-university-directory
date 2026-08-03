# GitHub Actions Node.js 24 升级设计

## 目标

消除 GitHub Actions 运行日志中的 Node.js 20 弃用警告，同时保持现有的每日数据刷新、CI 校验和 GitHub Pages 发布行为不变。

## 范围

升级三个工作流中使用的全部六个 GitHub 官方 Action，并继续以完整提交 SHA 固定版本：

| Action | 当前版本 | 目标版本 | 目标提交 SHA |
| --- | --- | --- | --- |
| `actions/checkout` | v4.4.0 | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | v6.5.0 | v7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/github-script` | v7.0.1 | v9.0.0 | `3a2844b7e9c422d3c10d287c895573f7108da1b3` |
| `actions/configure-pages` | v5 | v6.0.0 | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| `actions/upload-pages-artifact` | v3 | v5.0.0 | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| `actions/deploy-pages` | v4.0.5 | v5.0.0 | `cd2ce8fcbc39b97be8ca5fce6e763baed58fa128` |

目标版本和 SHA 来自各 Action 官方 GitHub 仓库在 2026-08-03 的最新正式 Release。除复合 Action `upload-pages-artifact` 外，其余目标版本均声明使用 `node24` 运行时。

## 保持不变的行为

- 项目依然通过 `actions/setup-node` 安装 Node.js 22；Action 自身改用 Node.js 24 不会改变项目构建版本。
- `CI` 的触发事件、只读权限、索引一致性检查、测试和构建顺序不变。
- 每日任务的时间表、异常 Issue、受保护的数据同步和精确 SHA 派发逻辑不变。
- Pages 的 `workflow_run` 触发、安全 SHA 校验、并发策略、构建目录和部署环境不变。
- 不修改院校数据、网页内容、依赖锁文件或应用代码。

## 实施方式

从远端最新 `main` 创建独立分支，仅替换 `.github/workflows/ci.yml`、`.github/workflows/daily-check.yml` 和 `.github/workflows/deploy.yml` 中的官方 Action SHA 与版本注释。现有的第三方 Lychee Action 保持不变。

工作流测试增加或更新断言，确保六个官方 Action 均固定到预期 SHA、旧 SHA 不再出现，并继续保留 Node.js 22 项目运行配置及 Pages 安全校验。

## 验证与发布

1. 本地运行工作流回归测试、完整测试和 Astro 构建。
2. 创建 PR，确认远端 CI 成功且日志不再出现 Node.js 20 弃用警告。
3. 合并后，以主分支 SHA 触发一次与每日任务相同的 `guarded-source-update`。
4. 确认 `repository_dispatch` CI 成功，并自动创建、完成 Pages 部署。
5. 在浏览器中确认线上首页可以加载。

## 失败处理与回滚

- 任一 PR 检查失败时不合并，依据具体 Action 日志修正或缩小升级范围。
- CI 成功但 Pages 未自动运行时，保留主分支不变并继续调查触发链路。
- 合并后若发布失败，优先回滚本次单一 PR，使工作流恢复到上一个已验证版本。

## 成功标准

- 三个工作流中的六个 GitHub 官方 Action 均使用上述固定 SHA。
- PR CI、模拟每日派发的 CI 和自动 Pages 发布全部成功。
- 新运行日志不再出现 Action 使用 Node.js 20 的弃用警告。
- 线上网页正常加载，且网页内容和数据未因本次升级改变。
