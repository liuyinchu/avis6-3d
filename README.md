# AVIS Six

六自由度六边形悬挂式主动隔振平台交互式 3D 模型。

**在线访问：[AVIS Six](https://liuyinchu.github.io/avis6-3d/)**

基于 Three.js 的静态网页，包含装配浏览、部件选择、全开放剖视、分解视图、六自由度运动演示及 PNG 导出。无需后端或构建步骤。

## 使用

拖动旋转，滚轮缩放，右键平移。通过左右面板切换部件、观察视角、标注与施力方向；底部面板控制运动自由度、幅值、速度和相位。

浏览器需支持 WebGL 2。运行预览服务器时，可在仓库目录执行 `ruby server.rb`，然后访问 `http://localhost:4173/`；需要 Ruby 与 WEBrick。

## 发布

此仓库为独立发布仓库，初始应用版本为 **v1.0.1**。项目开发资料与原始开发历史不包含在此仓库中。

推送 `main` 或手动运行 **Deploy AVIS Six** 工作流后，GitHub Actions 会检查发布文件范围、SHA-256 校验值及 JavaScript 语法，并只将 `web/` 部署到 GitHub Pages。部署后检查公开资源与提交内容是否一致。

更新应用文件时，同步更新 `.github/release-manifest.sha256`。Pages 的发布来源应设为 **GitHub Actions**。

## 目录

- `web/`：完整网页、模型与浏览器依赖。
- `server.rb`：可选的开发预览服务器。
- `.github/workflows/pages.yml`：校验与部署流程。
- `.github/release-manifest.sha256`：发布源文件校验值。

Three.js 0.170.0 及其官方附加模块采用 MIT 许可证，许可证文本保留在 `web/vendor/LICENSE.three.txt`。
