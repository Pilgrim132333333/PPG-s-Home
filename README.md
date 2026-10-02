# LoveIt Hugo 示例站

当前网站直接使用 LoveIt 官方 `exampleSite`，未替换为个人照片或个人化内容。

## 项目结构

- `hugo.toml`：官方示例配置，仅调整了 GitHub Pages 所需的站点地址和主题目录，并清空了被 GitHub 识别为密钥的 Mapbox 演示令牌
- `assets/`、`content/`、`static/`：复制自 `themes/LoveIt/exampleSite`
- `themes/LoveIt/`：LoveIt 主题子模块
- `legacy-site/`：原静态个人网站备份

## 本地预览

```bash
git submodule update --init --recursive
./serve.sh
```

请始终通过 `./serve.sh` 启动本地预览。脚本会显式使用 development
环境和本地 `baseURL`，关闭浏览器缓存，并在 1313 端口已被旧进程占用时
直接报告进程，而不是继续展示旧页面。需要其他端口时可运行：

```bash
PORT=1414 ./serve.sh
```

## 生成网站

```powershell
hugo --minify --gc
```

构建前可验证本地与 GitHub Pages 的资源路径没有串用：

```bash
./scripts/check-url-contract.sh
```

网站通过 GitHub Actions 自动发布到 GitHub Pages。
