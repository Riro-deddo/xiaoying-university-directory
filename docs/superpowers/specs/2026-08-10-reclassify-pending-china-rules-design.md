# 待确认院校二次复核与状态纠正设计

## 目标

重新核对目录中当前 11 所“待确认”院校，并依据 2026 年 8 月 10 日仍可直接访问的大学官方材料纠正状态和中文说明。

本轮要解决两个问题：

1. 已经公开中国申请要求的学校不能继续显示为“待确认”；
2. 对确实没有找到当前公开中国学术要求的学校，也不能暗示“学校没有内部规则”，只能说明本站当前无法从官网核验。

本轮不新增或推断任何中国大学名称，不把 211、认可院校、高排名院校、精英院校等模糊词语转换成本站自建名单。

## 复核结论

11 所学校中，没有一所公开了可按中国大学名称确定成员的完整院校 List。

### 改为“中国申请要求”的 9 所

以下学校已经公开面向中国申请者的学历、成绩或院校背景要求，因此从 `pending` 改为 `china-requirements`：

| 学校 | 官方证据 | 本站结论 |
| --- | --- | --- |
| 阿伯丁大学 | [China entry requirements](https://www.abdn.ac.uk/study/international/country-territory/china/entry/) | 公开中国成绩等效指引，无院校分组或名单 |
| 东安格利亚大学 | [China country requirements](https://www.uea.ac.uk/study/international-students/country-map/china) | 要求认可院校，具体门槛可能随本科院校变化，但未公开判断范围 |
| 伦敦都市大学 | [Students from China](https://www.londonmet.ac.uk/international/applying/countries/students-from-china/) | 使用“高排名中国院校”条件，但未定义或列出成员 |
| 罗汉普顿大学 | [Information for students from China](https://www.roehampton.ac.uk/student-support/international-students/countries/china/) | 对普通认可院校与 Project 211 使用不同门槛，但未提供成员名单 |
| 索尔福德大学 | [Salford and China](https://www.salford.ac.uk/international/your-country-or-region/salford-and-china) | 使用“信誉良好的中国大学”条件，但未公开定义 |
| 伍尔弗汉普顿大学 | [China entry requirements](https://www.wlv.ac.uk/international/your-country/china/) | 对普通认可院校与“精英/双评级”院校使用不同门槛，但未公开成员 |
| 爱丁堡玛格丽特女王大学 | [Information for students from China](https://www.qmu.ac.uk/study-here/international-students/information-for-your-country/china) | 公开认可大学学士学位与最低成绩要求，无院校名单 |
| 北安普顿大学 | [East Asia and South East Asia](https://www.northampton.ac.uk/international/your-country/east-asia-and-south-east-asia/) | 接受中国大学学士学位或认可的硕士预科，具体课程要求另查，无院校名单 |
| 南威尔士大学 | [China country requirements](https://www.southwales.ac.uk/international/your-country/china/) | 研究生与博士要求来自认可中国大学的相应学位，无公开认可范围 |

这些来源全部作为 `link-only` 官方来源登记。`institutionRule.type` 使用 `none`，表示本站没有确认可核验的院校成员名单；来源摘要和 caveat 仍须忠实记录官网提到的 211、认可院校、高排名院校或精英院校等条件。

### 保持内部 `pending` 的 2 所

以下学校经过当前官网、国家页、申请页、代表性课程页和官方文件复核后，仍没有足够的当前中国学术要求证据：

- 伦敦艺术大学（UAL）：当前招生政策和研究生申请页要求以课程页为准，没有当前中国学历或中国院校规则；公开的 2023–24 奖学金学历换算文件属于历史材料，不能作为 2026 招生规则。
- 东伦敦大学（UEL）：当前地区选择器没有中国大陆学术要求，学校层面只提供通用海外学历和课程要求；不能据此生成中国申请规则。

这两所继续保持 `pending`、`reviewStatus: blocked`、`sourceIds: []`。这里的 blocked 表示“完成搜索但公开证据不足”，不是网站尚未开始核查。

## 用户可见文案

将 `pending` 的展示名称从“待确认”改为：

> 官网暂无可核验规则

对应说明改为：

> 已核查当前公开官网，但信息不足以确认中国学历或院校限制；不代表学校没有内部规则，也不代表不能申请。

方法说明页同步解释：这个状态只描述本站当前能核验的公开信息，不对学校内部招生判断作否定结论。

UAL 和 UEL 的院校摘要分别写明已经检查过的官方信息边界，避免继续显示“尚待核查”。

## 数据写入

实施沿用现有数据模型：

- `src/data/universities.json`
  - 9 所更新为 `china-requirements`，绑定新增来源并写中性中文说明；
  - UAL、UEL 保持 `pending` 和空 `sourceIds`，只纠正说明文字。
- `src/data/sources.json`
  - 为 9 所新增大学层级、HTTPS、第一方的 `china-requirements` 来源；
  - 全部使用 `link-only`、`institutionRule.type: none`，不得产生结构化院校记录。
- `src/data/status.json`
  - 为 9 个新来源建立未检查的每日巡查状态；
  - 不预填成功日期、内容哈希或虚构健康结果。
- `src/data/china-rule-audit.json`
  - 9 所改为 `reviewed`，结论为 `china-requirements`；
  - UAL、UEL 保持 `blocked`，但将复核日期和 finding 更新到本轮证据。
- `src/data/institutions.json` 与 `src/data/requirements.json`
  - 不增加任何记录。
- `public/generated/**`
  - 只通过现有生成脚本更新，不手工编辑。

## 每日巡查

9 个新增官方来源加入现有每日巡查。每日巡查只检查链接可达性和内容变化：

- 正常访问时更新最近成功检查日期；
- 页面内容疑似变化时进入人工审核；
- 未经人工确认，不自动改写状态、中文摘要、成绩要求或院校事实；
- UAL 和 UEL 因没有可登记的当前中国学术来源，暂不创建虚假的巡查来源。未来发现可靠官方页时再按正常审核流程升级。

## 测试与验收

实施采用测试先行，并至少覆盖：

1. 11 所的精确状态：9 所 `china-requirements`、2 所 `pending`；
2. 9 个新增来源的大学归属、官方 URL、大学层级、中文语义和 `link-only` 零事实约束；
3. UAL、UEL 必须保持空 `sourceIds`，且中文说明不能再写“尚待核查”；
4. 101 所目录总数、93 所 QS 院校、8 所特色院校及排名数据不变；
5. `institutions.json`、`requirements.json` 和既有已审核院校事实不变；
6. 公开生成数据与源目录逐条一致；
7. 每日来源覆盖检查、全量测试、生产构建、初始 HTML 守卫和 `git diff --check` 全部通过；
8. 桌面与手机预览验证筛选数量、9 所新状态、UAL/UEL 新文案、官方链接、无伪造折叠 List、无横向溢出和控制台错误。

预期状态数量从：

- 中国申请要求：72
- 官网暂无可核验规则（原“待确认”）：11

变为：

- 中国申请要求：81
- 官网暂无可核验规则：2

其他状态数量保持不变。

## 非目标

- 不证明学校不存在内部院校规则；
- 不把“未公开名单”写成“名单外不能申请”；
- 不使用中介、小红书、论坛、缓存摘要或历史材料作为当前招生事实；
- 不根据 211、985、双一流、排名或“认可/高排名/精英”等词语自行补齐成员；
- 不改变目录范围、排名、特色院校说明、页面布局或专业功能；
- 不自动接受每日巡查发现的内容变化。
