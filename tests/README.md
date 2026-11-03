# 测试及现有基线（T0–T2 部分完成）

## 环境与恢复

2026-11-02：Windows 10.0.26200 x64、Node 24.18.1、npm 11.16.0、Playwright 1.64.1、Chromium headless 156.0.8078.4 / revision 1248、sRGB、light、reduced motion。视口分别 360×330 DPR 1 和 400×350 DPR 2；采用浏览器绑定 Chromium，不使用系统浏览器。网络和 Chromium 下载可用；预检空闲空间约 113 GB。字体环境为本机 Windows 默认环境，尚未单独固定或证明跨机可重现。

非 Git 工作区。`workspace-backups/pre-t0-t2/snapshot` 包含变更前文件（排除 node_modules、dist、.vykor 和备份目录）；manifest.json SHA-256 `705328E191DB87B34F1037F3E1977B7ED3AD3BB118EE0B1492645D13830CC05B`。11 文件已复制到独立临时目录并逐文件 SHA-256 验证，临时副本已删除。恢复时先校验 manifest，按需从 snapshot 复制到新的独立目录核对，不覆盖用户文件。该目录已排除测试扫描和 Git。

安装前 `npm ci`、`npm run typecheck`、`npm run build` 成功；npm 发出 esbuild install script 未审批警告，但本次构建成功。

## 运行

```
npm ci
npx playwright install chromium
npm run typecheck
npm run typecheck:tests
npm run build
npm run test:unit
npm run test:browser
```

浏览器测试通过 Playwright init script 在页面启动之前控制 RAF，应用及渲染器未作修改，事件使用真实键盘和指针。生产 preview 测试入口及测试全局不存在，并扫描构建文本；未取得构建依赖图，不能声称完整依赖图隔离验收。测试专用代码不由生产入口导入。实际输出和差异原始 RGBA 位于 `test-artifacts/`；比较器报告前 10 个差异像素及 RGBA，差异文件为无损原始 RGBA，不是图像格式。

## 小样本基线

`baselines/small-worlds/windows-x64-chromium-1248`：五场景各一个中间进度，两个视口，共 10 个无损 RGBA，约 11.34 MiB（含清单）。每帧真实按数字键进入并点击逻辑坐标 (172,312)，进度为 `(0.024+0.958*0.5)*0.999`；按场景顺序同页逐帧，初始 reduced-motion 第 4 秒。清单记录尺寸、哈希、事件与时间戳。两次独立命令采集，所有文件含清单 SHA-256 一致，归档后文件设置只读。常规测试使用归档对照，缺文件失败；采集使用独立目录并以独占创建避免覆盖。勿将此小样本误认为完整迁移门禁。

重复采集到**新**目录（两次分别指定不同路径）：

```powershell
$env:BASELINE_COLLECT_DIR='test-artifacts/new-collection'
npm run test:baseline:collect
Remove-Item Env:BASELINE_COLLECT_DIR
```

冻结文件仅可人工核验后另存，测试不会更新。基线依赖当前固定环境；跨平台、字体、GPU 或 Chromium 变化均不能假定零差异。产物和备份不能当作异地备份。

## 未完成及阻塞

- 未建立场景阈值/公共 p、冷启动、前后 seek、跨场景及动态材质的完整矩阵；未获第二人或用户复核。现有 10 帧只是小样本，不是 T2 验收。
- 未实现测试直达进度或状态探针；日志逆序、JCAP、构建次数、材质/缓存及动态状态均未验证。未完整验证拖动捕获、cancel、钳制、播放态拖动、背景及 resize；仅有部分事件和尺寸覆盖。
- 归档外第二次采集在临时产物目录；差异图仅原始 RGBA。尚无独立完整 manifest 校验器及生产依赖图检查。
- 性能边界、噪声控制和协议尚未获批；`npm run test:perf` 有意返回失败，未预设阈值，不代表性能通过。采集后仍需确认容忍区间。
- 因无 Git 无法提交；未进入 T3。固定视口与依赖版本为本次执行的选择，尚需作为长期环境获得确认。

## T2 后续采样（2026-11-02，未完成验收）

新增 `tests/support/t2-collect.mjs`：测试专用 Vite 路由替换 main.ts，在页面加载前注入可控 RAF、seek 和 draw 内部计时；生产源文件未修改。转换基于源文本锚点且校验唯一性，源码发生变化会失败。它使用 Vite 开发构建，而既有冻结基线来自生产构建，尚未逐帧证明适配前后等价，因此结果仅为候选证据，不能替代冻结基线。运行须指定不存在的新目录：

```powershell
$env:T2_OUTPUT='test-artifacts/unique-new-directory'
node tests/support/t2-collect.mjs
Remove-Item Env:T2_OUTPUT
```

`test-artifacts/t2-collection-20261102-b` 包含两次采集的各 110 个 RGBA 和路径清单；逐字节一致，清单 SHA-256 `EA49CE6D0353CC07C5401A0D56B40C3CEA5CD014943B0C2D7A9F1B45A8E99FE8`。五场景各 11 个公共 p、正向及反向路径、360×330 DPR1；每条路径新页面先绘 reduced-motion 第 4 秒，再依清单顺序测试直达。反向路径第一帧不是严格冷启动目标帧；未覆盖跨场景路径、关键事件阈值和 DPR2。两次在同一命令中独立创建页面，不是两次独立命令；仍须按计划独立命令复验。文件位于被忽略的临时产物目录，约 100 MiB，尚未冻结归档。旧基线未写入。

`performance.json`（SHA-256 `56EBE2895AE3D10DB30F6DDAB4879E821ACDC97A196F9308EEC2E1ECFB811542`）记录五场景各 5 个新页面首帧 p=.5、固定 p=.5 和移动 p=.75+i*.0001 各 30 预热及 100 采样，median、nearest-rank P95、原始样本及环境。计时在页面内完整 draw 两侧使用 performance.now，不包含通信、RAF 等待或读取像素；包含轻微插桩开销。移动路径不保证对应各场景高动态事件。样本为单次采集，浏览器测试曾与采集并行，机器有其他进程，噪声未受控；不能当作稳定性能基线或性能验收。performance.memory 为非标准近似 JS 堆，不代表总内存。仍需隔离负载、独立复采并确认测量协议、容忍区间与复测规则，不设阈值。

新增真实鼠标测试覆盖播放/暂停下 pointer capture、拖动期间画面静止、移动 seek 和释放后行为；另检查 Space 默认行为与 CSS 尺寸。2026-11-02 运行 typecheck、typecheck:tests、build、unit（1 项）及 browser（8 项）均成功。Space 默认行为测试使用合成键盘事件，其他现有键盘测试使用真实 Playwright 事件。

仍缺：逐场景关键分支完整清单及独立复核、冷启动/跨场景/A→B→A 路径、两视口完整矩阵、适配等价和生产依赖图隔离、状态探针及 JCAP 边界、拖动 cancel/越界/精确时间映射、背景阈值和 resize、可控噪声下性能复采与经批准的容忍区间。T2 未完成，不进入 T3。工作区不是 Git 仓库，无法提交；未初始化仓库。

## 2026-11-02 可读性重构与验证

在不改动 original.html 和冻结基线的前提下，提取严格类型数学、确定性查表、画面 UI，以及帧状态和重置边界。渲染器依然使用单实例共享状态与场景闭包，未完成按场景拆分及核心严格类型；不可将此次重构描述为完整迁移。保留 `workspace-backups/pre-refactor-20261102` 和其 SHA-256 清单作为本次重构前恢复点（非异地备份）。

复核 `t2-independent-c` 与 `t2-independent-d` 的 187 帧及清单、哈希全部一致；状态检查验证日志重复覆盖逆序恢复、越界、实际 300 万容量和场景缓存计数。生产构建模块图检查通过。`state-check.mjs` 改为仅在测试 Vite SSR 管线注入探针，兼容拆分后的导入。

`npm run typecheck`、`npm run typecheck:tests`、`npm run build`、`npm run test:unit`（3 项）及 `npm run test:browser`（11 项，包括两视口冻结小样本）通过。重构后 `t2-refactor-g/pixels-1` 与重构前 `t2-independent-c/pixels-1` 的 187 帧、清单与哈希逐字节一致；两视口冻结基线的 10 帧哈希亦与清单一致。性能结果请参见最终执行报告；T2 路径仍不构成独立复核的完整阈值矩阵。测试入口仅在开发转换中存在，不能将其视为生产构建的完整矩阵验证。

`test:perf` 当前仍刻意失败，提示原协议未批准；虽有 controlled-e 采样，本次复采与构建/浏览器测试存在并发，不能据此可靠判断性能回归或设定通过门槛。需隔离负载复采、评估波动后实施可重复门限；内存仅为非标准近似 JS 堆。首次重构采集 `t2-refactor-f` 因采集中修改源码触发 Vite reload 中断，不能用于比较。
## 2026-11-02 场景类型迁移增量

`seasons` 和 `city` 移除 `@ts-nocheck`，补充场景私有数据、插值关键帧、材质选项、树/土壤选项及部分几何回调类型；共享像素、深度、ramp 缓冲使用实际 typed array 类型。其余 renderer 和三个场景仍是 `@ts-nocheck`，部分 SceneContext 操作仍经 `LegacyHelper` 宽泛 any，renderer 本身没有被类型检查，因此接口尚未得到实现侧静态验证；颜色数组和场景延迟初始化的 ramp 对象也仍可进一步收紧。没有改动运行时调用顺序、状态所有权或管线拆分。完整严格类型迁移未完成。

变更前恢复点 `workspace-backups/pre-types-20261102`，清单 `manifest.sha256` 的 SHA-256 为 `46AEA11FDD8B7BA5518C10C47FFF4E4735D8D4214A7721F8CA63AAC6130E8FC8`；34 个文件复制到独立临时目录并逐项验证。备份不含原始附件或冻结基线，不是异地备份。

两次增量均执行 typecheck 和 build，最终还执行 typecheck:tests、unit（3 项）、browser（11 项）、状态探针及生产依赖图检查，均通过。两阶段各自采集 187 帧两遍并逐字节比较，分别与原先 `t2-independent-c` 的 manifest、哈希和帧逐字节一致：`test-artifacts/t2-types-seasons-20261102`、`test-artifacts/t2-types-city-20261102`。两视口冻结小样本通过，冻结基线文件前后 SHA-256 相同；`original.html` SHA-256 为 `B2234E7E07C84F42876030972871A06B0D2F3BD74E6CB38756D607B566E58985`。187 帧依旧是测试开发管线、未独立复核的候选矩阵，不是完整 T2 验收。

采集期间与浏览器测试并发，采集生成的耗时数据不作为性能判断。`npm run test:perf` 有意退出 1：协议和门槛未获批准；未声称性能通过。工作区无 Git 仓库，无法提交；未擅自初始化。其余测试缺口参见上文。

## 2026-11-02 渲染管线拆分

将材质与调色板、几何构造、体素光照及后处理分别提取到 `src/renderer/materials.ts`、`geometry.ts`、`pipeline.ts`。通过显式类型上下文绑定当前场景的缓冲及计数；帧编排、场景切换、动态覆盖日志与回滚仍由单实例 facade 管理，帧内顺序未变。新增单元测试覆盖材质缓存/场景切换及几何写入/树的时间恢复。

`npm run build`（含源码类型检查）、`npm run typecheck:tests`、`npm run test:unit`（5 项）、`npm run test:browser`（11 项）、`node tests/support/state-check.mjs` 和生产模块图检查均通过。新采集 `test-artifacts/t2-pipeline-split-20261102` 两次各 187 帧逐字节一致；与 `t2-independent-c` 的清单、哈希和 187 帧逐字节一致。两视口冻结小样本通过，12 个冻结目录文件前后 SHA-256 未变；`original.html` 前后 SHA-256 均为 `B2234E7E07C84F42876030972871A06B0D2F3BD74E6CB38756D607B566E58985`。

187 帧来自测试专用开发转换，非完整生产管线/全阈值矩阵验收；比较对象为既有候选采集而非冻结的 187 帧基线。性能无经批准门槛，本次采集附带的计时不构成性能结论。单实例、共享状态、动态日志及帧调度仍未解耦；后处理和光照在同一管线模块内，测试覆盖不代表所有场景状态组合。工作区不是 Git 仓库，无法提交；未初始化或改动原始附件与冻结基线。

## 2026-11-02 最终源码测试增量

本次仅修改 tests 和 package.json，未改 src、原始附件或冻结基线。适配拆分后的 RendererContext / dynamic-overlay：`npm run test:state` 覆盖同坐标逆序恢复、无效坐标、真实 300 万日志容量、切换 active scene 后恢复原 owner，以及跨场景缓存与计数；未独立测量 build 次数。`tests/SCENE-EVENTS.md` 是人工关键事件清单及未穷举项，并未获得独立复核。

最终源码的候选矩阵用两次独立命令采集，分别位于 `test-artifacts/matrix-final-20261102-a/matrix.json` 和 `...-b/matrix.json`；各 1928 个完整 RGBA 的 SHA-256、路径信息和整个 manifest 一致（manifest SHA-256 `9C0A812DF9FCDA908B0C910FC4FA42E75BBEE32E6209727E47AA8AD958E42995`）。覆盖两组 viewport/DPR、公共点、固定事件边界前/中/后、每公共点冷启动、前后 seek 和跨场景/日夜路径；结果保存哈希而非原始 RGBA，因此无法对这些采样进行逐通道诊断，也没有迁移前同路径冻结基线；不是完整旧版等价验收。采集前后与当前全部 src 哈希相同。路径使用测试专用 dev 转换；生产 bundle 与该适配路径通过真实键盘和鼠标比对 94 帧完整 RGBA 字节一致、两视口及背景一致，但不能推广至未采事件和直接 seek。生产依赖图检查也通过。

复现时必须设置新路径；采集不会覆盖基线：

```powershell
$env:MATRIX_OUTPUT='test-artifacts/matrix-new'; npm run test:matrix
$env:T2_OUTPUT='test-artifacts/perf-new'; npm run test:perf:sample
npm run test:state
npm run test:production-graph
npm run test:production-equivalence
```

性能两次串行运行于所有本次测试任务完成之后，未与本次其他测试并发，但不能控制桌面其他进程和温度；Intel Core 5 220H、Chromium 156.0.8078.4，360×330 DPR1。每场景冷页 5 次、固定和动态各预热 30/采 100，performance.now 包围 draw；结果及原始样本分别为 `test-artifacts/perf-final-20261102-a/performance.json`（SHA-256 `E99641E5B779E911983B8795A5D5305D16184D369B593F61A7A81E442F27958F`）和 `...-b/performance.json`（`F1A07327D1DF72E0B90F6A35AF3D2C700E5B4FCE110B51DAF4293EAFD50F0DC7`）。两个采集前后及当前源码哈希一致。示例：rise 固定帧中位数 35.25/11.05 ms、P95 57.7/12.0 ms，波动过大，不能可靠计算回归阈值；未建立迁移前可比性能基线，故 `npm run test:perf` 明确返回 1，不宣称通过。`performance.memory` 两次均为约 116 MB JS 堆，非标准 API，不代表总内存。

最终实际命令结果：typecheck、typecheck:tests、build、unit 5/5、browser 12/12、state、production-graph、production-equivalence 全通过。浏览器首次因并发负载下新增测试 30 秒超时，单独复测通过后增加超时，完整重跑通过。测试 artifacts 为本机临时产物，不是异地归档。无 Git 仓库，无法提交，未擅自初始化。

## 蒸汽车站增量

第六场景使用静态站房、站台和轨道；机车与烟雾通过动态覆盖写入，随场景进度离站；调色、窗灯、背景和后处理灯光随时间变化。`tests/unit/station.spec.ts` 验证固定帧往返、场景切换、缓存和背景重置；`tests/browser/station.spec.ts` 以生产构建验证数字键、寻址、日夜及跨场景往返。原有指针测试覆盖六场景循环和无效数字键。

历史冻结基线仍为五场景、两个视口的原始文件，未重采或覆盖。由于标题总数由 5 变 6，比较时只屏蔽标题中总数字及一像素描边区域，其他像素仍逐字节比较；该区域不再受旧基线验证，整个新场景也没有冻结视觉基线。旧版采集脚本和候选矩阵仍仅覆盖五场景，不构成新场景的完整矩阵或性能验收。

旧 `test:baseline:collect` 在设置 `BASELINE_COLLECT_DIR` 时现在明确拒绝采集，避免把六场景 UI 的画面误标为历史五场景基线；如需新基线，须另行设计与审批独立协议。
