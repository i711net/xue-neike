# 学内科 · 西医内科学学习与考试平台

纯静态网站（HTML + CSS + JS，无构建步骤、无后端），可直接部署到 Cloudflare Pages / GitHub Pages。

- **学习区**：8 个系统、142 章目录；每章含「讲义精讲 / 重点提示 / 章节自测」。未写完的章节显示"建设中"。
- **考试区**：执业医师题型（A1、A2、A3/A4、B1）；计时模拟卷（随机组卷、答题卡、交卷评分、按系统/题型/章节统计）、系统练习、题型专练、错题本、成绩记录。
- 学习进度、错题、成绩保存在浏览器 localStorage。

## 目录

```
index.html
assets/app.js      页面逻辑
assets/style.css   样式
data/toc.js        系统与章节目录
data/<系统>.js     各系统内容，用 IM.fill('<系统id>', { '章节标题': { lecture, keys, quiz } })
```

## 添加内容

1. 在 `data/` 下对应系统文件里，按 `data/toc.js` 中的**章节标题**增加一项（标题必须完全一致）。
2. 新建文件时，在 `index.html` 底部加一行 `<script src="data/xxx.js"></script>`（放在 `assets/app.js` 之前）。
3. 题目格式见 `data/toc.js` 顶部注释。

## 部署到 Cloudflare Pages

1. 把本目录推送到 GitHub 仓库。
2. Cloudflare 控制台 → Workers 和 Pages → 创建 → Pages → 连接到 Git → 选择该仓库。
3. 框架预设选 **None**，构建命令留空，构建输出目录填 `/`。
4. 部署完成后在「自定义域」里绑定子域名（如 `neike.991828.xyz`）。

## 声明

内容参照《内科学》教材章节体例并结合近年诊疗指南原创整理，仅供学习备考，不作为个体诊疗依据。
