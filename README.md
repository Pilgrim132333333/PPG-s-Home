# 郭梓耕个人网站（Hugo）

这是基于 [LoveIt](https://github.com/dillonzq/LoveIt) 主题搭建的个人网站。

## 目录说明

- `hugo.yaml`：站点、导航、主页、搜索与主题配置。
- `content/`：关于、经历、项目，以及后续可添加的博客文章。
- `static/`：图片、favicon 和下载文件等静态资源。
- `assets/css/`：LoveIt 的配色与项目卡片自定义样式。
- `themes/LoveIt/`：通过 Git submodule 引入的 LoveIt 主题。
- `legacy-site/`：迁移前的旧版静态网站，原始文件保持不变。

## 本地预览

1. 安装 Hugo Extended 0.146.0 或更高版本。
2. 克隆仓库时同步主题：

   ```powershell
   git clone --recurse-submodules https://github.com/Pilgrim132333333/PPG-s-Home.git
   ```

   已经克隆过仓库时运行：

   ```powershell
   git submodule update --init --recursive
   ```

3. 启动开发服务器：

   ```powershell
   hugo server -D
   ```

4. 生成可部署网站：

   ```powershell
   hugo --minify
   ```

生成结果位于 `public/`，该目录不会提交到 Git。

## 更新主题

```powershell
git submodule update --remote --merge themes/LoveIt
```
