# 中国院校规则完整复核与 LBS 收录设计

## 目标

把“小英高校百科”从“按一次搜索结果标记是否有 List”升级为可复核的中国院校规则目录。本次覆盖原有 28 所 QS 2027 世界前 200 英国大学，并新增 London Business School（LBS）。每所学校都必须有明确状态、官方来源、适用范围和中文说明，不能把“完整名单未公开”误写成“学校不看本科院校”。

页面总体定位、静态免费部署、每日 GitHub Actions 检查、大学搜索和中国本科院校反向搜索保持不变。

## 本轮官方来源复核结论

### 全校层面存在公开完整校名表或查询表

以下 9 所学校登记为 `official-list`。只有完成安全结构化的来源才在站内生成折叠表；结构化尚未完成时显示官方直达链接和中性说明。

| 学校 | 规则含义 | 当前处理 |
| --- | --- | --- |
| University College London | 院校成绩分档；名单外教育部认可院校仍可按更高门槛申请 | 保留现有结构化表 |
| University of Edinburgh | Priority List 与课程 Band 共同决定要求 | 保留现有结构化表 |
| University of Southampton | Tier 决定成绩门槛，未列院校按官网规则处理 | 新增安全结构化表 |
| University of Cambridge | Group A/B 与成绩门槛对应，不是统一白名单 | 新增安全结构化表 |
| University of Warwick | 官网明确仅考虑页面所列大学，并存在课程差异 | 新增安全结构化表 |
| University of Bristol | 官网公开 accepted Chinese universities，并存在课程限制 | 新增安全结构化表 |
| University of Glasgow | 官网 PDF 明确只考虑表中中国大学，并列成绩要求 | 新增安全结构化表 |
| University of Nottingham | 官网公开 Tier 1/Tier 2 中英文院校表，法学院另有要求 | 新增安全结构化表 |
| University of Sheffield | 官网公开中英文院校与 2:1/2:2 成绩查询表 | 新增安全结构化表 |

### 学院或专业层面存在单独规则

- University of Manchester：总校、计算机、法学等公开页面均明确本科院校质量会影响要求，但当前未发现官网公开完整校名表。曼大不得显示成“法学院公开名单”，应显示为“院校限制存在，完整名单未公开”，并分别列出总校与已核对的学院/专业要求。
- University of Leeds：总校说明不同学院使用不同院校标准。只有仍然属于当前申请季、适用范围清楚且可由官方来源核验的学院校名表才可折叠展示；旧申请季名单只作为历史来源，不作为当前结论。
- 任何新增学院来源必须标明 `faculty` 或 `programme`，折叠面板必须显示“仅适用于”提示，不得外推到全校。

### 院校背景影响要求，但官网未公开完整校名表

以下学校登记为 `china-requirements`，显示中文规则摘要和官网链接，不生成虚构校名表：

- Imperial College London
- University of Oxford
- King's College London
- London School of Economics and Political Science
- University of Birmingham
- Queen Mary University of London
- University of St Andrews
- University of Liverpool
- Newcastle University
- University of York
- Lancaster University
- Queen's University Belfast
- Cardiff University
- University of Reading
- University of Manchester
- University of Leeds（总校层面）

这些来源可能使用 211、985、双一流、prestigious、highly regarded、well-ranked、Tier 或外部排名等表述。网站只总结大学官网明确写出的规则，不把外部排名完整复制为大学自有名单。

### 暂未发现选择性中国本科院校名单

- University of Exeter：2026 年官网明确取消原有国内大学排名要求，接受所有中国教育部认可本科院校，并统一采用相应分数标准。不得继续展示旧版排名 PDF 为当前规则。
- Durham University：本轮官网复核未找到当前公开完整校名表或明确的中国院校分档表。
- University of Bath：本轮官网复核未找到当前公开完整校名表；课程成绩与背景要求仍以课程页为准。
- London Business School：本轮官网复核未找到中国本科院校名单；只显示已核对的项目申请要求与“未发现公开名单”。

以上学校登记为 `not-public`。该状态只表示“当前未发现公开选择性院校规则”，不表示学校不接受中国申请者。

## LBS 的目录定位

LBS 不伪造 QS 世界大学综合排名。大学数据增加明确目录类别：

```ts
type DirectoryCategory = 'qs-top-200' | 'specialist';

interface University {
  directoryCategory: DirectoryCategory;
  qs?: { edition: 2027; rank: number };
}
```

- 原有 28 所均为 `qs-top-200`，必须保留 `qs`。
- LBS 为 `specialist`，不得出现 `qs`，卡片显示“专业院校”。
- 排序先按 QS 名次显示 28 所，再显示专业院校；同类专业院校未来按中文名排序。
- 页面范围文案改为“QS 2027 世界前 200 英国大学 + 专业院校补充”，并动态显示数量。

## 数据状态与来源规则

大学状态继续使用：

- `official-list`：全校层面存在公开校名表、分档表或查询表。
- `china-requirements`：明确存在中国院校背景规则，但完整校名表未公开。
- `faculty-only`：只有学院或专业层面存在公开规则或校名表；必须同时登记适用范围。
- `not-public`：本轮未发现公开选择性中国院校规则。
- `pending`：来源仍在复核，不能发布确定结论。

每个来源继续登记 `institutionRule.type`：

- `eligibility`：院校成员身份明确影响申请资格。
- `grade-threshold`：院校成员身份或 Tier 只影响最低成绩。
- `mixed`：不同课程同时包含资格限制和成绩分档。
- `none`：来源没有可查询的中国本科院校成员表。

`link-only` 只表示没有安全结构化，不等于没有院校规则。大学状态必须由人工核对的来源语义决定，不能由解析器模式反推。

## 覆盖矩阵与防遗漏校验

新增一份受版本控制的覆盖矩阵，列出 29 所学校的预期目录类别、状态、至少一个官方来源和复核日期。自动测试必须保证：

1. 28 所 QS 学校与 QS cohort 文件一一对应，LBS 是唯一新增专业院校；
2. 每所学校至少有一个官方 HTTPS 来源；
3. 每个来源都有中文摘要、规则类型、适用范围和人工复核信息；
4. `official-list` 至少包含本设计列出的 9 所，不允许遗漏回退；
5. Manchester 不得再标为公开学院名单；
6. Exeter 必须显示取消院校排名要求，且旧版 PDF 不得作为当前规则；
7. `link-only` 且规则类型非 `none` 的来源必须显示“规则存在，名单尚未安全结构化”，不能显示“未发现院校规则”；
8. 学院/专业来源不能生成学校层面的未命中结论；
9. LBS 不得获得虚构 QS 名次，并排序在 QS cohort 之后。

## 抓取与更新策略

- HTML 表格、列表和 PDF 只通过已登记选择器或行规则解析。
- 每个新结构化来源使用独立的记录数量上下限、最大删除比例和必需规则文本。
- 当前页面无法稳定解析、动态加载或存在大量重复/更名冲突时，先保留 `link-only`，不能用不完整数据冒充完整名单。
- 每日自动任务只更新结构化院校事实和来源健康状态，不自动修改人工复核的规则含义。
- 规则关键文字变化、记录数量越界、重复项异常或来源不可用时，保留上一版可信数据，停止发布该来源的新结果并创建复核提示。
- 不调用付费 API；运行只使用 GitHub Actions、GitHub Pages 和大学公开官网。

## 页面展示

- 大学卡片顶部显示目录类别、QS 名次或“专业院校”、中国院校规则状态。
- `official-list`：显示规则类型和折叠入口；折叠内先解释名单含义、名单外含义、适用范围和申请季，再列院校。
- `china-requirements`：显示“本科院校会影响要求，完整名单未公开”，再显示中文摘要和官网链接。
- `faculty-only`：醒目标明学院或专业名称；不得显示成全校规则。
- `not-public`：显示“本轮未发现公开选择性院校名单”，同时保留一般申请要求链接。
- 所有结论都显示最近人工复核日期或最近成功自动检查日期。

## 测试与验收

- 数据测试：覆盖矩阵 29/29，来源外键完整，状态与规则类型一致。
- 排序测试：QS 学校按名次，LBS 在其后且显示“专业院校”。
- 解析器测试：每种新增官方页面结构使用本地固定样本先红后绿；不依赖实时网络作为单元测试。
- 同步测试：记录数量下降、规则文字变化、重复院校和空结果都会阻止覆盖可信数据。
- 页面测试：9 所公开名单均出现正确入口；无法安全结构化的来源显示直达官网而不是空折叠。
- 曼大回归测试：总校、计算机和法学规则可见，不出现“曼大法学院公开院校名单”。
- 埃克塞特回归测试：显示 2026 年取消院校排名要求。
- 浏览器验收：桌面和 320px 手机宽度下，搜索、筛选、LBS 卡片、公开名单折叠和规则未公开提示均可读且无横向溢出；控制台无相关错误。
- 完整验证：数据检查、全部单元测试、静态构建、来源覆盖报告和工作流静态检查全部通过后才可发布。

## 非目标

- 不复制中介、自媒体或小红书流传的内部名单。
- 不把旧申请季 PDF 冒充当前要求。
- 不根据大学名气猜测申请资格、院校分组或分数线。
- 不把“名单内找到”简化成“保证可以申请”，也不把“未找到”简化成“不能申请”。
- 不承诺覆盖未公开的内部招生政策。
