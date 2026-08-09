# 扩展英国特色院校与强势学科说明设计

## 目标

在现有 93 所 QS 2027 英国院校主目录上，保留已确认的伦敦商学院（LBS）、伦敦卫生与热带医学院（LSHTM）和克兰菲尔德大学（Cranfield），再新增五所特色院校：

- 皇家艺术学院（Royal College of Art，RCA）；
- 皇家兽医学院（Royal Veterinary College，RVC）；
- 皇家音乐学院（Royal College of Music，RCM）；
- 伦敦癌症研究院（The Institute of Cancer Research, London，ICR）；
- 利物浦热带医学院（Liverpool School of Tropical Medicine，LSTM）。

目录总数从 96 所扩展为 101 所：93 所 `qs-directory` 和 8 所 `specialist`。伦敦艺术大学（UAL）已在 93 所 QS 主目录中，不重复新增；只为它增加一条艺术与设计强势学科说明。

## 设计原则

1. 只展示能由学校官网、排名机构官方页面或英国官方研究评估资料核验的信息。
2. 学科排名、排名区间和英国国内科研评估是三种不同证据，不得统一伪装成“全球第 X”。
3. 强势学科说明只用于理解院校特色，不改变 QS/THE 综合排名，也不参与排序计算。
4. UAL 继续作为 QS 主目录院校参与综合排序；8 所特色院校在 QS、THE 和名称排序中都固定放在 93 所主目录院校之后。
5. 中国申请要求与“中国本科院校 List”必须分开。没有发现完整公开院校名单时，不得显示为“有中国院校规则”。
6. 新增官方来源纳入每日低频检查，但自动化只记录内容变化或访问异常，不自动改写已审核摘要。
7. 不修改现有 QS/THE 综合排名、已接受的中国院校规则事实、院校名称库或反向索引事实。

## 统一的“院校亮点”数据结构

将现有只服务特色院校的 `specialistRanking` 迁移为任意院校都可选使用的 `strengthEvidence`。它不是第三个综合排名，只是一条可点击的专业实力依据。

字段语义：

- `kind`：`subject-ranking` 或 `research-assessment`；
- `provider`：`qs`、`shanghai` 或 `ref`；
- `rankingName`：官方榜单或评估名称；
- `subjectZh`：中文学科名称；
- `edition`：发布年份；
- `placement`：`exact`、`band` 或 `derived-national-exact`；
- `displayRank`：官方名次、区间或经明确标注的国内分析名次；
- `sourceUrl`：HTTPS 官方来源；
- `noteZh`：院校特色和是否参与综合排序的简短说明。

文案生成规则：

- 全球精确名次：`QS 2026 艺术与设计全球第 1`；
- 全球区间：`软科 2025 公共卫生全球 76–100`，不加“第”；
- 国内派生分析：`REF 2021 结果加权分析：生物科学英国第 1`，不声称为全球排名。

页面不按院校 ID 硬编码文案。所有说明均由 `strengthEvidence` 和统一展示函数生成。

## 已核验的院校亮点

| 院校 | 展示内容 | 排序语义 | 官方依据 |
| --- | --- | --- | --- |
| UAL | QS 2026 艺术与设计全球第 2 | 继续参与 QS/THE 综合排序 | `https://www.arts.ac.uk/about-ual/press-office/stories/qs-world-rankings-2026` |
| LBS | QS 2026 商业与管理全球第 9 | 不参与综合大学排序 | `https://www.topuniversities.com/universities/london-business-school` |
| Cranfield | QS 2026 机械、航空与制造工程全球第 55 | 不参与综合大学排序 | `https://www.cranfield.ac.uk/som/press/cranfield-amongst-the-best-in-the-world-in-latest-qs-subject-rankings` |
| LSHTM | 软科 2025 公共卫生全球第 3 | 不参与综合大学排序 | `https://www.shanghairanking.com/universities/london-school-of-hygiene-tropical-medicine` |
| RCA | QS 2026 艺术与设计全球第 1 | 不参与综合大学排序 | `https://www.rca.ac.uk/news-and-events/news/royal-college-of-art-celebrates-12th-consecutive-year-as-the-worlds-leading-university-for-art-and-design/` |
| RVC | QS 2026 兽医学全球第 1 | 不参与综合大学排序 | `https://www.rvc.ac.uk/news-and-events/rvc-news/the-rvc-tops-global-rankings-once-again` |
| RCM | QS 2026 音乐与表演艺术全球第 2 | 不参与综合大学排序 | `https://www.rcm.ac.uk/about/news/all/2026-03-26qsrankings2026.aspx` |
| ICR | REF 2021 结果加权分析：生物科学英国第 1 | 不参与综合大学排序；不是全球学科榜 | `https://www.icr.ac.uk/about-us/icr-news/detail/icr-rated-second-in-uk-among-all-higher-education-institutions-in-ref-2021-analysis` |
| LSTM | 软科 2025 公共卫生全球 76–100 | 不参与综合大学排序 | `https://www.shanghairanking.com/universities/liverpool-school-of-tropical-medicine` |

## 新增院校身份与搜索

| 稳定 ID | 中文名 | 英文名 | 主要别名 |
| --- | --- | --- | --- |
| `royal-college-of-art` | 皇家艺术学院 | Royal College of Art | RCA |
| `royal-veterinary-college` | 皇家兽医学院 | Royal Veterinary College | RVC |
| `royal-college-of-music` | 皇家音乐学院 | Royal College of Music | RCM |
| `institute-of-cancer-research-london` | 伦敦癌症研究院 | The Institute of Cancer Research, London | ICR, Institute of Cancer Research |
| `liverpool-school-of-tropical-medicine` | 利物浦热带医学院 | Liverpool School of Tropical Medicine | LSTM |

五所院校的 `directoryCategory` 均为 `specialist`。特色院校内部继续使用英文名、稳定 ID 的确定性排序。

## 申请要求与官方来源

### 本轮已先实施的两所申请来源

- LSHTM 保留 `china-requirements`：官方中国页公布研究生学历等值与 80%/85% 参考要求，但没有完整公开中国本科院校名单。
- Cranfield 保留 `china-requirements`：官方中国页公布 2:2/2:1 研究生要求，但没有完整公开中国本科院校名单。

### 新增五所

- RCA：状态 `not-public`。链接 `https://www.rca.ac.uk/study/apply-to-study/`；申请以课程条件、作品集和英语要求为准，未发现完整中国院校名单。
- RVC：状态 `not-public`。链接 `https://www.rvc.ac.uk/study/international-students/how-to-apply`；学术资历按课程页核对，未发现完整中国院校名单。
- RCM：状态 `china-requirements`。链接 `https://www.rcm.ac.uk/international/china/`；强调课程要求、作品集/面试与 UCAS Conservatoires 申请流程，不生成中国院校 List 事实。
- ICR：状态 `not-public`。链接 `https://www.icr.ac.uk/study-and-careers/opportunities-for-clinicians/msc-in-oncology`，摘要必须明示：该授课型项目是非常狭窄的在职临床课程，通常要求医学学位、至少两年临床经验、英国 GMC 注册和在英临床岗位；不得将它描述为普通国际学生授课型硕士。
- LSTM：状态 `not-public`。链接 `https://lstmed.ac.uk/study/` 和具体课程入学要求；未发现完整中国院校名单。

上述五个新增申请要求来源使用 `link-only`，记录人工核验日期、官方 URL 和必要文字守卫。学科亮点来源只存入 `strengthEvidence`，不混入每日申请来源检查。两类来源都不生成院校成员、成绩分档事实或反向索引记录。

## 页面行为

- 首页结果数为 101。
- 范围文案为“93 所 QS 2027 英国院校 + 8 所特色院校”。
- 8 所特色院校的 QS 2027 和 THE 2026 综合排名位统一显示 `—`。
- UAL 显示原有 QS/THE 综合排名，并在同一位置额外显示艺术与设计全球第 2 说明。
- 每所拥有 `strengthEvidence` 的院校在现有蓝色说明框中显示一条可点击的官方依据，不新建单独页面或新排序按钮。
- 方法说明页列出证据类型和年份，明确 REF 不是全球学科榜，排名只作信息参考。
- 中英文搜索必须命中五所新院校的正式名称和缩写。

## 数据、自动检查与错误边界

- 新增五所院校、五个申请入口来源和对应审计记录；对应状态从 `unchecked` 开始。
- 每日检查仍使用现有失败阈值、内容变更待审和不自动改写已接受内容的语义。
- 强势学科来源与申请要求来源分开存储：前者支持亮点说明，后者支持来源状态和每日检查。
- 排名来源变更时，只进入人工更新流程，不被每日来源检查自动改名次。
- 官网 403、429、5xx、超时或内容变更不得删除院校或伪造新摘要；页面继续显示上一版人工核验内容和当前来源状态。

## 数据与构建边界

允许修改：

- 院校目录、schema、类型和院校亮点展示函数；
- 来源、状态、中国院校规则审计记录和来源覆盖检查；
- 首页、方法说明页、SSR 行数守卫和院校目录公开 JSON；
- 相关自动测试。

禁止修改：

- `rankings.json` 及 QS/THE 综合排名记录；
- `requirements.json` 中已接受的中国院校规则事实；
- `institutions.json` 和既有中国本科院校名称；
- 既有公开 List 文件和既有反向索引事实。

## 测试与验收

实施必须遵循 RED → GREEN：

1. 数据契约测试先要求 101 所唯一院校、93 所 QS 主目录和精确 8 所特色院校。
2. 测试 `strengthEvidence` 的三种排名位置语义和文案，特别覆盖精确名次、区间不加“第”、REF 明示“结果加权分析”和“英国”。
3. 测试 UAL 仍为 `qs-directory`、保留 QS/THE 综合排名并额外显示艺术与设计亮点。
4. 测试五所新院校的稳定 ID、中英文名称、缩写、官方域名、状态、申请来源和亮点依据。
5. 测试 QS、THE、名称排序均保留前 93 所主目录语义，并把 8 所特色院校稳定放在最后。
6. 测试五所新院校的中英文搜索、缩写搜索和状态筛选；ICR 的狭窄课程范围边界不得丢失。
7. 测试来源覆盖、审计状态、官方域名、每日检查输入和不生成院校 List 事实。
8. 测试初始 HTML 含 101 个唯一院校行，前 93 所保持 QS 顺序，特色院校在后；公开院校 JSON 同样为 101 条。
9. 运行完整测试和正式构建，确认受保护事实文件无语义漂移。
10. 在桌面和 390px 手机视口搜索 UAL 与五所新院校，检查名称、标签、综合排名、亮点说明、申请摘要、HTTPS 官方链接、控制台与横向溢出。

## 明确不做

- 不再扩展到其他艺术学院、音乐学院、商学院或研究所。
- 不收录新增院校的全部硕士专业。
- 不自动抓取、翻译或概括每个专业的申请要求。
- 不增加第三个综合排名排序按钮。
- 不将 REF 分析、学科排名或学科区间用于判断申请资格。
- 不因为没有公开中国院校 List 就推断某所中国本科院校不能申请。
