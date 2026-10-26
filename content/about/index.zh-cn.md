---
title: "关于我"
date: 2026-09-26
draft: false
layout: "about"
comment: false
description: "郭梓耕的自我介绍：写代码、调 bug、偶尔建点什么，大部分时间都在自我怀疑。"
eyebrow: "👋 你好，我是郭梓耕"
headline: "把『这到底咋回事？』变成『哦，原来是这么回事』——虽然常常要花很久。"
intro: "计算机在读，业余代码考古学家。喜欢扒别人写的聪明代码，然后自己动手写一版——通常比原版烂，但是我的。"
contactLabel: "来聊聊天"
signalLabel: "我常说的话"
signals: ["真的，在我机器上能跑", "再改一个 commit 就睡", "等等，这里为什么这么慢？", "文档明天一定补"]
portraitAlt: "郭梓耕的头像"
status: "最近在：写 MiniServing、看 LMCache、以及向自己解释内核为什么崩了"
---

<section class="about-section about-letter-section" aria-labelledby="about-me-zh">
  <div class="about-section-heading">
    <span>01</span>
    <div>
      <p class="about-kicker">说点实话</p>
      <h2 id="about-me-zh">我一天到晚到底在干嘛</h2>
    </div>
  </div>

  <div class="about-letter">
    <p>一个冷知识：我大部分时间都处于「搞不懂」状态，只是伪装得比较好。我的工作流程很简单——看到一个不懂的东西，先被它冒犯一下，然后不搞明白就不睡觉。</p>
    <p>现在让我搞不懂的主要是 AI 系统和推理。我喜欢读比我聪明的人写的代码（vLLM、LMCache，就是那几位老朋友），然后自己试着写个迷你版。我的版本更烂，但它是<em>我的</em>。说真的，在 C++ 里弄崩一个东西，比读十篇教程学到的都多。</p>
    <p>这个博客就是我扔学习笔记的地方，好让未来的自己不用把同一个 bug 调三遍。要是顺便帮到了你，那就是意外之喜。</p>
  </div>
</section>

<section class="about-section" aria-labelledby="about-current-zh">
  <div class="about-section-heading">
    <span>02</span>
    <div>
      <p class="about-kicker">桌面上</p>
      <h2 id="about-current-zh">最近在折腾（以及搞坏）的东西</h2>
    </div>
  </div>

  <div class="about-focus-grid about-current-grid">
    <article class="about-focus-card about-focus-card-featured">
      <span class="about-card-code">01 · MiniServing</span>
      <h3>手搓一个小型 LLM 推理服务，专挑难路走</h3>
      <p>我本可以用现成框架？当然可以。但我偏要自己手写 continuous batching 和 paged KV cache？也没错。它起初只是「我想弄懂推理是怎么跑的」，很快就变成了「要不我从头实现一个吧」。通往理解最快的路，同时也是通往后悔最快的路。</p>
      <div class="about-tag-row"><span>C++</span><span>CUDA</span><span>PyTorch</span><span>后悔</span></div>
    </article>

    <article class="about-focus-card">
      <span class="about-card-code">02 · Visual Reasoning</span>
      <h3>让模型证明自己是真懂了</h3>
      <p>我在跑 3D RAVEN 这类的抽象视觉推理实验。最有趣的部分是抓模型作弊——它答案对了，但压根没学到规律，简直就像我。我的活，就是不让它们蒙混过关。</p>
      <div class="about-tag-row"><span>3D RAVEN</span><span>PredRNet</span><span>OOD</span></div>
    </article>

    <article class="about-focus-card">
      <span class="about-card-code">03 · Open Source</span>
      <h3>读那些我希望是自己写的代码</h3>
      <p>我把 vLLM 和 LMCache 的 issue 当悬疑小说看。顺着一个 bug 在庞然大物般的代码库里追到底，那种满足感很奇妙——就像在衣服堆里找到一只袜子，只不过你找到的不叫袜子，叫内存泄漏。</p>
      <div class="about-tag-row"><span>vLLM</span><span>LMCache</span><span>Issues</span></div>
    </article>
  </div>
</section>

<section class="about-section" aria-labelledby="about-bits-zh">
  <div class="about-section-heading">
    <span>03</span>
    <div>
      <p class="about-kicker">简历部分</p>
      <h2 id="about-bits-zh">正经信息（证明我不只是嘴贫）</h2>
    </div>
  </div>

  <div class="about-fact-grid">
    <article><span>在读</span><p>诺丁汉大学计算机科学<br>有个我不想大声说怕说没了的绩点</p></article>
    <article><span>做过</span><p>在联想用 Java / Spring Boot 参与内部供应商系统——在那里我学会了「本地能跑」是个危险的句子</p></article>
    <article><span>也做过</span><p>大学官网开发维护，加上 GIS 研究实习，看地图看到对制图师肃然起敬</p></article>
    <article><span>想去的方向</span><p>AI 系统、开源工程，以及那些真能回答的问题</p></article>
  </div>
</section>

<section class="about-section about-closing" aria-labelledby="about-hello-zh">
  <p class="about-kicker">来打招呼</p>
  <h2 id="about-hello-zh">如果你也在调 bug，我们一起来困惑吧。</h2>
  <p>可以聊推理系统、视觉推理、开源，或者直接把你最诡异的 bug 发给我，我们一起破案。</p>
  <div class="about-closing-links">
    <a href="mailto:pilgrim137735@gmail.com">pilgrim137735@gmail.com <span aria-hidden="true">↗</span></a>
    <a href="https://github.com/Pilgrim132333333" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
  </div>
</section>