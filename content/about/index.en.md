---
title: "About"
date: 2026-09-26
draft: false
layout: "about"
comment: false
description: "A casual introduction to Zigeng Guo—mostly debugging, occasionally building, always a little bit confused."
eyebrow: "👋 Hi, I'm Zigeng"
headline: "I turn 'how does this even work?' into 'oh, that's why it works'—eventually."
intro: "CS student, part-time code archaeologist. I dig through other people's clever code, then try (and often scramble) to write my own."
contactLabel: "Come say hi"
signalLabel: "Things I say a lot"
signals: ["It worked on my machine, I swear", "Just one more commit", "Wait, why is this slow?", "I'll document it tomorrow"]
portraitAlt: "Portrait of Zigeng Guo"
status: "Currently: building MiniServing, reading LMCache, and explaining to myself why the kernel crashed"
---

<section class="about-section about-letter-section" aria-labelledby="about-me-en">
  <div class="about-section-heading">
    <span>01</span>
    <div>
      <p class="about-kicker">Honest version</p>
      <h2 id="about-me-en">What I actually do with my day</h2>
    </div>
  </div>

  <div class="about-letter">
    <p>Fun fact: I spend most of my time being confused. I just got really good at hiding it. My workflow is simple—see a thing I don't understand, feel slightly offended by it, then refuse to sleep until I do understand it.</p>
    <p>Right now my confusion is mostly about AI systems and inference. I like reading code written by people smarter than me (vLLM, LMCache—you know, the usual suspects) and trying to build tiny versions of it myself. Mine are worse, but they're <em>mine</em>, and honestly, breaking something in C++ teaches you more than reading ten Medium articles.</p>
    <p>This blog is where I dump what I learn so Future Me doesn't have to re-debug the same thing three times. If it helps you too, that's a bonus.</p>
  </div>
</section>

<section class="about-section" aria-labelledby="about-current-en">
  <div class="about-section-heading">
    <span>02</span>
    <div>
      <p class="about-kicker">On my desk</p>
      <h2 id="about-current-en">Things I'm currently breaking</h2>
    </div>
  </div>

  <div class="about-focus-grid about-current-grid">
    <article class="about-focus-card about-focus-card-featured">
      <span class="about-card-code">01 · MiniServing</span>
      <h3>Building a small LLM inference server, the hard way</h3>
      <p>Could I have used an existing framework? Absolutely. Did I instead decide to hand-roll continuous batching and paged KV cache? Also yes. It started as "let me understand how inference works" and quickly became "let me reimplement it from scratch." The fastest path to regret is also the fastest path to understanding.</p>
      <div class="about-tag-row"><span>C++</span><span>CUDA</span><span>PyTorch</span><span>Regret</span></div>
    </article>

    <article class="about-focus-card">
      <span class="about-card-code">02 · Visual Reasoning</span>
      <h3>Making models prove they actually understand</h3>
      <p>I run 3D RAVEN-style visual reasoning experiments. The fun part is catching a model cheating—it gets the answer right without learning the rule, which is exactly what I'd do if I could get away with it. My job is to not let them get away with it.</p>
      <div class="about-tag-row"><span>3D RAVEN</span><span>PredRNet</span><span>OOD</span></div>
    </article>

    <article class="about-focus-card">
      <span class="about-card-code">03 · Open Source</span>
      <h3>Reading code I wish I'd written</h3>
      <p>I read vLLM and LMCache issues like they're a thriller novel. Tracing one bug through a giant codebase is oddly satisfying—like finding that one sock in a laundry pile, except instead of a sock, it's a memory leak.</p>
      <div class="about-tag-row"><span>vLLM</span><span>LMCache</span><span>Issues</span></div>
    </article>
  </div>
</section>

<section class="about-section" aria-labelledby="about-bits-en">
  <div class="about-section-heading">
    <span>03</span>
    <div>
      <p class="about-kicker">The résumé bits</p>
      <h2 id="about-bits-en">The formal stuff (so you know I'm not just vibes)</h2>
    </div>
  </div>

  <div class="about-fact-grid">
    <article><span>Studying</span><p>CS at the University of Nottingham<br>Somehow maintaining a GPA I won't jinx by saying out loud</p></article>
    <article><span>Built</span><p>A supplier system at Lenovo using Java and Spring Boot—where I learned that "it works locally" is a dangerous phrase</p></article>
    <article><span>Also did</span><p>University website dev, plus a GIS research internship where I stared at maps long enough to respect cartographers</p></article>
    <article><span>Heading toward</span><p>AI systems, open-source engineering, and questions that can actually be answered</p></article>
  </div>
</section>

<section class="about-section about-closing" aria-labelledby="about-hello-en">
  <p class="about-kicker">Say hello</p>
  <h2 id="about-hello-en">If you're also debugging things, let's be confused together.</h2>
  <p>Talk to me about inference systems, visual reasoning, open source—or just send me your weirdest bug and we'll figure out who's at fault.</p>
  <div class="about-closing-links">
    <a href="mailto:pilgrim137735@gmail.com">pilgrim137735@gmail.com <span aria-hidden="true">↗</span></a>
    <a href="https://github.com/Pilgrim132333333" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
  </div>
</section>