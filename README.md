# Small Worlds

使用 Vite 和 TypeScript 的等距像素场景，保留原始 Canvas 体素渲染，包含六个动画场景。

## 开发

需要 Node.js 20.19+ 或 22.12+。

```sh
npm install
npm run dev
npm run build
npm run preview
```

空格暂停或播放，左右方向键切换场景，数字键 1–6 直接选择场景，拖动画面下方滑块调整进度。系统启用减少动态效果时默认暂停。

第六场景「STEAM STATION」描绘乡间车站、站台、铁轨和蒸汽机车：从 17:00 至 21:00 天色渐暗，车站亮灯，机车在后段出发，烟雾随时间升起。进度条支持正反向定位。

## 结构

- `src/main.ts`：画布、播放循环与用户输入。
- `src/renderer.ts`：单实例组合根与场景帧编排；`src/renderer/context.ts` 持有活动场景别名、共享缓冲和计数，`dynamic-overlay.ts` 管理有场景归属的动态覆盖日志及逆序恢复。`src/renderer/` 还包含材质、几何、渲染与后处理管线、帧状态和共享类型。
- `src/scenes/`：六个独立场景及其与渲染器之间的接口。
- `src/core/`：严格类型的数学函数及确定性查表。
- `src/ui/draw.ts`：严格类型的缩放与画面内 UI，像素缓冲和场景信息由调用方传入。
- `original.html`：原始附件，用于对照。

渲染器和六个场景均已启用 TypeScript 检查，并为场景接口、材质及几何回调补充类型。渲染器仍为单实例，复用帧状态和动态覆盖日志；验证范围与已知限制详见 `tests/README.md`。
