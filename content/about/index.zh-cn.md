---
title: "关于我"
date: 2026-09-26
draft: false
layout: "about"
comment: false
description: "郭梓耕：关注 LLM 推理系统、抽象视觉推理和可落地的 AI 工程。"
eyebrow: "郭梓耕 · Computer Science"
headline: "把复杂问题拆开，直到它可以被理解、实现和验证。"
intro: "我在诺丁汉大学学习计算机科学。目前，我把主要精力放在 LLM 推理系统、抽象视觉推理和 AI 工程上：既想理解一行底层代码为什么影响性能，也想知道一个研究想法如何变成可靠的实验。"
contactLabel: "和我聊聊"
signalLabel: "个人关键词"
signals: ["Inference Systems", "Visual Reasoning", "Open Source", "Build to Learn"]
portraitAlt: "郭梓耕的头像"
status: "正在构建 MiniServing，并探索 LLM serving 与视觉推理"
---

<section class="about-section" aria-labelledby="about-now-zh">
  <div class="about-section-heading">
    <span>01</span>
    <div>
      <p class="about-kicker">Right now</p>
      <h2 id="about-now-zh">我现在关注的三件事</h2>
    </div>
  </div>

  <div class="about-focus-grid">
    <article class="about-focus-card about-focus-card-featured">
      <span class="about-card-code">SYS</span>
      <h3>LLM 推理系统</h3>
      <p>从 MiniServing 的调度器、Continuous Batching 和 Paged KV Cache 出发，继续阅读 vLLM 与 LMCache。我希望理解性能问题怎样从 Tensor 布局一路传导到缓存、调度与分布式数据流。</p>
      <div class="about-tag-row"><span>C++</span><span>CUDA</span><span>PyTorch</span><span>KV Cache</span></div>
    </article>

    <article class="about-focus-card">
      <span class="about-card-code">VIS</span>
      <h3>抽象视觉推理</h3>
      <p>围绕 3D RAVEN-style 数据集、PredRNet、STSN 与感知模块做实验，关注模型是否真的学会规则，以及它能否跨域泛化，而不只是记住训练分布。</p>
      <div class="about-tag-row"><span>3D RAVEN</span><span>Reasoning</span><span>OOD</span></div>
    </article>

    <article class="about-focus-card">
      <span class="about-card-code">BLD</span>
      <h3>把想法做成工具</h3>
      <p>从 AI 学习助手到 Web 系统和实验流水线，我关心的不只是功能能否运行，也关心资料怎样组织、反馈怎样进入系统，以及别人能否清楚地使用和维护它。</p>
      <div class="about-tag-row"><span>Python</span><span>Java</span><span>Web</span><span>AI Apps</span></div>
    </article>
  </div>
</section>

<section class="about-section about-method" aria-labelledby="about-method-zh">
  <div class="about-section-heading">
    <span>02</span>
    <div>
      <p class="about-kicker">How I work</p>
      <h2 id="about-method-zh">我的工作方式</h2>
    </div>
  </div>

  <div class="about-principles">
    <article>
      <strong>01</strong>
      <h3>先建立可验证的最小路径</h3>
      <p>面对大系统时，我习惯先做最小实现和可信参考，再逐步增加优化。正确性不是性能之后的补丁，而是优化的起点。</p>
    </article>
    <article>
      <strong>02</strong>
      <h3>在抽象层之间追问题</h3>
      <p>一个异常可能来自数学、Tensor 布局、算子、缓存或调度。我喜欢沿着数据流向下追，直到每个假设都能被解释。</p>
    </article>
    <article>
      <strong>03</strong>
      <h3>把过程沉淀下来</h3>
      <p>我会记录设计选择、失败原因和实验边界。写作帮助我判断自己究竟理解了什么，也让下一次迭代更快。</p>
    </article>
  </div>
</section>

<section class="about-section" aria-labelledby="about-path-zh">
  <div class="about-section-heading">
    <span>03</span>
    <div>
      <p class="about-kicker">Selected path</p>
      <h2 id="about-path-zh">学习与实践</h2>
    </div>
  </div>

  <div class="about-timeline">
    <article>
      <div class="about-time">2022 — 至今</div>
      <div>
        <h3>计算机科学 · University of Nottingham</h3>
        <p>GPA 3.9 / 4.0，Ye Yaozhen 奖学金获得者。我的课程基础覆盖数据结构、算法、数据库、软件工程、人工智能和计算机视觉。</p>
      </div>
    </article>
    <article>
      <div class="about-time">2025</div>
      <div>
        <h3>软件开发实习 · Lenovo GSG E2E</h3>
        <p>参与内部供应商系统的搭建与维护，使用 Java / Spring Boot 支持数据日期追踪、定期归档与后端流程。</p>
      </div>
    </article>
    <article>
      <div class="about-time">Campus</div>
      <div>
        <h3>全栈开发 · 大学官方网站</h3>
        <p>参与网站功能更新和日常维护，在真实使用场景中理解前后端协作、内容管理与长期维护。</p>
      </div>
    </article>
    <article>
      <div class="about-time">2023</div>
      <div>
        <h3>GIS 研究实习 · 天津市滨海新区先进研究院</h3>
        <p>参与地理信息方向的技术研究任务，接触地理空间技术、数据研究和技术文档整理。</p>
      </div>
    </article>
  </div>
</section>

<section class="about-section about-closing" aria-labelledby="about-next-zh">
  <p class="about-kicker">Next</p>
  <h2 id="about-next-zh">我想继续靠近真正困难、也真正有用的问题。</h2>
  <p>现在的我仍在形成自己的方向。我希望继续参与开源系统和研究项目，在系统性能、模型能力与真实使用之间建立更扎实的连接。</p>
  <div class="about-closing-links">
    <a href="mailto:pilgrim137735@gmail.com">pilgrim137735@gmail.com <span aria-hidden="true">↗</span></a>
    <a href="https://github.com/Pilgrim132333333" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
  </div>
</section>
