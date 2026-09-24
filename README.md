# 郭梓耕个人网站（Hugo）

这是基于 [Hugo Profile](https://github.com/gurusabarish/hugo-profile) 主题搭建的个人网站。

## 目录说明

- `hugo.yaml`：站点内容和主题配置，个人介绍、经历、教育和项目都在这里维护。
- `content/`：后续可添加博客文章或独立页面。
- `static/`：图片、favicon 和下载文件等静态资源。
- `themes/hugo-profile/`：通过 Git submodule 引入的 Hugo Profile 主题。
- `legacy-site/`：迁移前的旧版静态网站，原始文件保持不变。

## 本地预览

1. 安装 Hugo 0.87.0 或更高版本。
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
git submodule update --remote --merge themes/hugo-profile
```
