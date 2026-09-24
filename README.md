# LoveIt Hugo 示例站

当前网站直接使用 LoveIt 官方 `exampleSite`，未替换为个人照片或个人化内容。

## 项目结构

- `hugo.toml`：官方示例配置，仅调整了 GitHub Pages 所需的站点地址和主题目录，并清空了被 GitHub 识别为密钥的 Mapbox 演示令牌
- `assets/`、`content/`、`static/`：复制自 `themes/LoveIt/exampleSite`
- `themes/LoveIt/`：LoveIt 主题子模块
- `legacy-site/`：原静态个人网站备份

## 本地预览

```powershell
git submodule update --init --recursive
hugo server -D
```

## 生成网站

```powershell
hugo --minify --gc
```

网站通过 GitHub Actions 自动发布到 GitHub Pages。
