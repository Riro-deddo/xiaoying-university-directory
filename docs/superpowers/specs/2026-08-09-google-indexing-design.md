# Google 收录基础配置设计

## 目标

让 Google 更容易发现并正确识别「小英高校百科」的公开页面，同时保持现有界面、院校数据和每日来源审查流程不变。

正式站点地址：`https://riro-deddo.github.io/xiaoying-university-directory/`

## 方案

1. 由 Astro 生成 `sitemap.xml`，列出首页和方法说明页。
2. 首页和方法说明页分别输出绝对 canonical 地址，避免带 `?v=` 的分享链接被视为独立页面。
3. 保留现有中文页面标题和 description；本次不增加关键词堆砌、独立排名页面或结构化院校详情页。
4. 增加自动化契约测试，检查 sitemap 和两个 canonical 地址；运行完整测试与生产构建。

本项目是 GitHub Pages 子目录站点。Google 只接受域名根目录的 `robots.txt`，而项目无法在本仓库写入 `https://riro-deddo.github.io/robots.txt`；子目录中的同名文件无效。未提供 robots 文件默认即允许抓取，因此本次不生成误导性的项目级 `robots.txt`，改由 Search Console 直接提交 sitemap。

## 边界

- 不修改任何大学、中国院校、排名、申请要求或来源状态数据。
- 不改变桌面端和移动端视觉布局。
- 不引入付费服务、数据库或新的常驻服务器。
- 网站端配置只能帮助 Google 发现页面，不能保证立即收录或获得特定搜索排名。

## 上线后的人工步骤

网站发布后，在免费的 Google Search Console 中验证站点所有权，提交 sitemap，并通过网址检查请求首页收录。Google 的实际抓取和收录时间由 Google 决定。

## 验收标准

- 生产构建成功。
- 正式页面包含正确的绝对 canonical。
- 正式站点可访问 sitemap。
- 完整自动化测试通过。
- 现有界面与院校数据没有任务相关变化。
