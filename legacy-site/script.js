const header = document.querySelector("[data-header]");
const menuButton = document.querySelector("[data-menu-button]");
const mobileNav = document.querySelector("[data-mobile-nav]");
const languageButtons = document.querySelectorAll("[data-language]");
const renderTargets = document.querySelectorAll("[data-render]");
const hero = document.querySelector(".hero");
const projectModal = document.querySelector("[data-project-modal]");
const projectModalLabel = document.querySelector("[data-project-label]");
const projectModalTitle = document.querySelector("[data-project-title]");
const projectModalSummary = document.querySelector("[data-project-summary]");
const projectModalBody = document.querySelector("[data-project-body]");
const projectCloseButtons = document.querySelectorAll("[data-project-close]");
let currentDictionary;
let activeProjectId;

const translations = {
  zh: {
    meta: {
      title: "郭梓耕 | 个人介绍",
      description: "郭梓耕的个人介绍网站：关于兴趣、学习路径、技术探索、项目和联系方式。",
    },
    brand: "Zigeng's Homepage",
    language: { label: "语言切换" },
    nav: {
      aria: "主导航",
      mobileAria: "移动端导航",
      homeLabel: "返回首页",
      menuOpen: "打开导航",
      menuClose: "关闭导航",
      about: "关于我",
      workbench: "工作台",
      path: "路径",
      contact: "联系",
      cta: "联系我",
    },
    projectDetail: {
      closeLabel: "关闭项目详情",
    },
    hero: {
      eyebrow: "Zigeng's Homepage",
      initials: "ZG",
      title: "Zigeng Guo",
      chineseName: "郭梓耕",
      role: "Computer Science · AI Applications · Full-Stack",
      taglinePrefix: "Building tools that",
      highlight: "organize knowledge",
      actionsLabel: "首页快捷入口",
      linkAbout: "About",
      linkProjects: "Projects",
      linkEmail: "Email",
      explore: "Explore",
      metaLabel: "个人关键词",
      metaOne: "AI Applications",
      metaTwo: "Full-Stack Systems",
      metaThree: "Visual Reasoning",
    },
    about: {
      kicker: "About Me",
      title: "我关注怎样把想法变成清晰、可靠、可使用的东西。",
      copy: "我学习计算机科学，也在 AI 应用、工程系统、算法实验和视觉研究里寻找自己的方向。",
      lead:
        "我学习计算机科学，也在 AI 应用、工程系统、算法实验和视觉研究里寻找自己的方向。比起罗列经历，我更想展示自己如何观察问题、拆解问题，并把它落到可以运行的产品或实验里。",
      highlights: [
        { label: "学习", title: "计算机科学", copy: "GPA 3.9 / 4.0，Ye Yaozhen 奖学金获得者。" },
        { label: "构建", title: "AI + Web 工具", copy: "关注知识库、学习助手、后端系统和可用的产品体验。" },
        { label: "探索", title: "视觉与算法", copy: "从遗传算法到视觉推理，用实验理解抽象问题。" },
      ],
      notes: [
        {
          title: "我喜欢把复杂问题拆小。",
          copy: "无论是学习助手、遗传算法还是视觉推理，我都会先把目标拆成可以验证的步骤，再通过结果反推设计是否合理。",
        },
        {
          title: "我在意技术是否真的好用。",
          copy: "对我来说，AI 应用不只是接入模型，而是把数据、场景、反馈和人的使用习惯连接起来。",
        },
        {
          title: "我希望进入真实团队继续成长。",
          copy: "联想实习、网站维护和研究项目让我意识到，好的工程需要长期维护，也需要理解协作边界和业务流程。",
        },
      ],
    },
    workbench: {
      kicker: "Workbench",
      title: "我做过的东西，以及它们背后的问题",
      copy: "点击任意项目，会跳出独立的项目详情页面，里面可以继续扩展背景、目标、方法和收获。",
      open: "查看详情",
      items: [
        {
          id: "learning-assistant",
          label: "AI Learning Support",
          title: "诺丁汉大学计算机系学习助手",
          summary: "把课程资料、题库、历史学习数据和个人知识库组织起来，让 AI 真正服务学习过程。",
          details: [
            "目标：支持课程答疑、复习建议、资料检索和知识点查询。",
            "重点：设计资料检索、题目库生成、个人知识库构建和 AI 问答流程。",
            "收获：我开始意识到 AI 应用的关键不是“有模型”，而是把数据、场景、反馈和使用习惯接起来。",
          ],
        },
        {
          id: "genetic-algorithm",
          label: "Algorithm",
          title: "遗传算法解决在线背包问题",
          summary: "从 0 搭建遗传算法框架，通过参数调优和结果对比提升解的质量。",
          details: [
            "目标：用遗传算法处理在线背包问题，比较不同参数对结果的影响。",
            "重点：实现编码、适应度函数、种群初始化、选择、交叉、变异和迭代更新。",
            "收获：算法项目让我更习惯记录假设、控制变量和解释实验结果，而不是只追求一次跑通。",
          ],
        },
        {
          id: "ai-agent",
          label: "Research",
          title: "Emotionally Expressive 3D AI Agent",
          summary: "探索 AI 智能体如何通过表情和语调表达情感，让交互更自然。",
          details: [
            "目标：支持一个能够通过面部表情和语调表达情感的 3D AI Agent。",
            "重点：与团队协作探索多模态情感表达对交互体验的影响。",
            "收获：我开始从“功能是否存在”转向思考“功能如何被人感知”。",
          ],
        },
        {
          id: "leaf-recognition",
          label: "Computer Vision",
          title: "叶子识别项目",
          summary: "基于 MTD、LBP、color model 和高斯模糊优化图像预处理与特征提取。",
          details: [
            "目标：提升叶片识别表现，理解不同图像特征对识别效果的影响。",
            "重点：围绕 MTD 与 LBP 进行特征方法实验，并优化预处理流程。",
            "收获：视觉项目让我看到数据质量、特征设计和模型效果之间的细微关系。",
          ],
        },
        {
          id: "visual-reasoning",
          label: "Visual Reasoning",
          title: "跨域抽象视觉推理数据集与可泛化方法研究",
          summary: "构建 RAVEN-style 3×3 跨域抽象推理数据集，关注规则、解释和泛化。",
          details: [
            "目标：构建面向分布外场景的抽象视觉推理数据集和可泛化方法。",
            "重点：规则标注、解释文本生成、泛化验证和可解释性验证。",
            "进展：项目进行中，目标投稿 CVPR / ICCV / AAAI，后续扩展至 TPAMI / TIP。",
          ],
        },
      ],
    },
    path: {
      kicker: "Path",
      title: "几段让我接触真实问题的实习经历",
      copy: "这里不再铺开完整经历，只简单说明我在哪些真实场景里做过事。",
      items: [
        {
          label: "2025",
          title: "联想 GSG E2E 部门实习",
          summary: "参与内部供应商系统搭建与维护，用 Java / Spring Boot 支持数据日期追踪和定期归档。",
          meta: "联想天津分部",
        },
        {
          label: "Campus",
          title: "全栈开发实习生",
          summary: "参与大学官方网站开发和维护，支持页面功能更新与日常维护工作。",
          meta: "大学官方网站开发与维护",
        },
        {
          label: "2023",
          title: "地理信息系统实习",
          summary: "在地理信息研究部门参与技术研究任务，接触地理空间技术和数据研究方向。",
          meta: "天津市滨海新区先进研究院",
        },
      ],
    },
    toolkit: {
      kicker: "Toolkit",
      title: "工具只是工具，真正重要的是我用它们解决什么。",
      items: [
        {
          title: "工程工具",
          copy: "Java、Python、C++、C、Vue.js、Spring Boot、RESTful API、MySQL、数据库设计、SQL 查询和数据归档。",
        },
        {
          title: "AI 与算法",
          copy: "遗传算法、SVM、KNN、随机森林、参数调优、实验对比、LLM、知识库和 AI 问答应用。",
        },
        {
          title: "视觉与研究",
          copy: "Color model、高斯模糊、MTD、LBP、图像预处理、特征提取、抽象视觉推理和论文阅读。",
        },
      ],
    },
    contact: {
      kicker: "Contact",
      title: "欢迎联系我。",
      copy: "邮件点击后会直接打开你的邮件客户端。",
      items: [
        { label: "个人邮箱", value: "pilgrim137735@gmail.com", href: "mailto:pilgrim137735@gmail.com" },
        { label: "学校邮箱", value: "scyzg6@nottingham.edu.cn", href: "mailto:scyzg6@nottingham.edu.cn" },
        { label: "电话", value: "+86 18649201011", href: "tel:+8618649201011" },
      ],
    },
    footer: { copyright: "© 2026 郭梓耕", top: "Back to top" },
  },
  en: {
    meta: {
      title: "Zigeng Guo | Personal Introduction",
      description: "Zigeng Guo's personal introduction site: interests, learning path, technical exploration, selected projects, and contact.",
    },
    brand: "Zigeng's Homepage",
    language: { label: "Language switcher" },
    nav: {
      aria: "Main navigation",
      mobileAria: "Mobile navigation",
      homeLabel: "Back to home",
      menuOpen: "Open navigation",
      menuClose: "Close navigation",
      about: "About",
      workbench: "Workbench",
      path: "Path",
      contact: "Contact",
      cta: "Contact",
    },
    projectDetail: {
      closeLabel: "Close project detail",
    },
    hero: {
      eyebrow: "Zigeng's Homepage",
      initials: "ZG",
      title: "Zigeng Guo",
      chineseName: "郭梓耕",
      role: "Computer Science · AI Applications · Full-Stack",
      taglinePrefix: "Building tools that",
      highlight: "organize knowledge",
      actionsLabel: "Homepage quick links",
      linkAbout: "About",
      linkProjects: "Projects",
      linkEmail: "Email",
      explore: "Explore",
      metaLabel: "Personal keywords",
      metaOne: "AI Applications",
      metaTwo: "Full-Stack Systems",
      metaThree: "Visual Reasoning",
    },
    about: {
      kicker: "About Me",
      title: "I care about turning ideas into things that are clear, reliable, and usable.",
      copy: "I study computer science and explore my direction through AI applications, engineering systems, algorithm experiments, and visual reasoning.",
      lead:
        "I study computer science and keep finding my direction through AI applications, engineering systems, algorithm experiments, and visual reasoning. Rather than listing experience, I want this site to show how I observe problems, break them down, and turn them into working products or experiments.",
      highlights: [
        { label: "Study", title: "Computer Science", copy: "GPA 3.9 / 4.0 and Ye Yaozhen Scholarship recipient." },
        { label: "Build", title: "AI + Web Tools", copy: "Interested in knowledge bases, learning assistants, backend systems, and usable product experiences." },
        { label: "Explore", title: "Vision & Algorithms", copy: "From genetic algorithms to visual reasoning, I use experiments to understand abstract problems." },
      ],
      notes: [
        {
          title: "I like making complex problems smaller.",
          copy: "Whether I work on learning assistants, genetic algorithms, or visual reasoning, I start by turning goals into testable steps and let results challenge the design.",
        },
        {
          title: "I care whether technology is actually usable.",
          copy: "For me, an AI application is not just a model call. It is the connection between data, context, feedback, and the way people actually work.",
        },
        {
          title: "I want to keep growing in real teams.",
          copy: "Lenovo, website maintenance, and research projects taught me that good engineering needs long-term maintainability, collaboration boundaries, and business context.",
        },
      ],
    },
    workbench: {
      kicker: "Workbench",
      title: "Things I have built, and the questions behind them",
      copy: "Click any project to open a focused project detail page where background, goals, methods, and takeaways can be expanded.",
      open: "View Detail",
      items: [
        {
          id: "learning-assistant",
          label: "AI Learning Support",
          title: "Computer Science Learning Assistant for Nottingham",
          summary: "Organizing course materials, question banks, learning history, and personal knowledge bases so AI can support the learning process.",
          details: [
            "Goal: support course Q&A, revision suggestions, material retrieval, and concept lookup.",
            "Focus: design flows for course-material retrieval, question-bank generation, personal knowledge-base construction, and AI Q&A.",
            "Takeaway: AI applications are not just about having a model. They depend on connecting data, scenarios, feedback, and user habits.",
          ],
        },
        {
          id: "genetic-algorithm",
          label: "Algorithm",
          title: "Genetic Algorithm for the Online Knapsack Problem",
          summary: "Built a genetic algorithm framework from scratch and improved solution quality through parameter tuning and comparison.",
          details: [
            "Goal: use a genetic algorithm for the online knapsack problem and compare the effect of different parameters.",
            "Focus: implement encoding, fitness functions, population initialization, selection, crossover, mutation, and iterative updates.",
            "Takeaway: algorithm projects trained me to document assumptions, control variables, and explain results rather than only making code run once.",
          ],
        },
        {
          id: "ai-agent",
          label: "Research",
          title: "Emotionally Expressive 3D AI Agent",
          summary: "Exploring how AI agents can express emotion through facial expressions and tone for more natural interaction.",
          details: [
            "Goal: support a 3D AI Agent capable of emotional expression through face and voice.",
            "Focus: collaborate with the team to explore the role of multimodal emotional expression in interaction experience.",
            "Takeaway: I started thinking beyond whether a feature exists and toward how it is perceived by people.",
          ],
        },
        {
          id: "leaf-recognition",
          label: "Computer Vision",
          title: "Leaf Recognition Project",
          summary: "Optimized image preprocessing and feature extraction with MTD, LBP, color models, and Gaussian blur.",
          details: [
            "Goal: improve leaf recognition performance and understand how different visual features affect results.",
            "Focus: experiment with MTD and LBP feature methods and refine preprocessing workflows.",
            "Takeaway: vision projects showed me the subtle relationship between data quality, feature design, and model performance.",
          ],
        },
        {
          id: "visual-reasoning",
          label: "Visual Reasoning",
          title: "Cross-Domain Abstract Visual Reasoning Dataset and Generalizable Methods",
          summary: "Building a RAVEN-style 3×3 cross-domain abstract reasoning dataset with rules, explanations, and generalization checks.",
          details: [
            "Goal: build a dataset and generalizable method for out-of-distribution abstract visual reasoning.",
            "Focus: rule annotation, explanation text generation, generalization validation, and interpretability checks.",
            "Status: in progress, targeting CVPR / ICCV / AAAI with future extensions toward TPAMI / TIP.",
          ],
        },
      ],
    },
    path: {
      kicker: "Path",
      title: "Internships that brought me closer to real problems",
      copy: "This section now keeps the path simple and focuses only on internship experience.",
      items: [
        {
          label: "2025",
          title: "Lenovo GSG E2E Internship",
          summary: "Worked on an internal supplier system and used Java / Spring Boot to support data date tracking and scheduled archiving.",
          meta: "Lenovo Tianjin Branch",
        },
        {
          label: "Campus",
          title: "Full-Stack Development Intern",
          summary: "Contributed to university website development and maintenance, supporting feature updates and daily page work.",
          meta: "University official website development and maintenance",
        },
        {
          label: "2023",
          title: "GIS Internship",
          summary: "Participated in technical research tasks and gained exposure to geospatial technology and data research.",
          meta: "Tianjin Binhai New Area Advanced Research Institute",
        },
      ],
    },
    toolkit: {
      kicker: "Toolkit",
      title: "Tools are only tools. What matters is what I use them to solve.",
      items: [
        {
          title: "Engineering Tools",
          copy: "Java, Python, C++, C, Vue.js, Spring Boot, RESTful APIs, MySQL, database design, SQL queries, and data archiving.",
        },
        {
          title: "AI & Algorithms",
          copy: "Genetic algorithms, SVM, KNN, random forests, parameter tuning, experiment comparison, LLMs, knowledge bases, and AI Q&A applications.",
        },
        {
          title: "Vision & Research",
          copy: "Color models, Gaussian blur, MTD, LBP, image preprocessing, feature extraction, abstract visual reasoning, and paper reading.",
        },
      ],
    },
    contact: {
      kicker: "Contact",
      title: "Feel free to contact me.",
      copy: "Clicking an email address will open your mail app.",
      items: [
        { label: "Personal Email", value: "pilgrim137735@gmail.com", href: "mailto:pilgrim137735@gmail.com" },
        { label: "University Email", value: "scyzg6@nottingham.edu.cn", href: "mailto:scyzg6@nottingham.edu.cn" },
        { label: "Phone", value: "+86 18649201011", href: "tel:+8618649201011" },
      ],
    },
    footer: { copyright: "© 2026 Zigeng Guo", top: "Back to top" },
  },
};

const getNestedValue = (source, keyPath) =>
  keyPath.split(".").reduce((value, key) => value?.[key], source);

const createElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
};

const renderAbout = (target, dictionary) => {
  const intro = createElement("article", "about-intro-card");
  intro.append(createElement("p", "lead-copy", dictionary.about.lead));

  const highlights = createElement("div", "about-highlights");
  dictionary.about.highlights.forEach((item) => {
    const highlight = createElement("article", "about-highlight");
    highlight.append(
      createElement("span", "", item.label),
      createElement("strong", "", item.title),
      createElement("p", "", item.copy),
    );
    highlights.append(highlight);
  });
  intro.append(highlights);

  const notes = createElement("div", "about-notes");
  dictionary.about.notes.forEach((item) => {
    const note = createElement("article", "about-note");
    note.append(createElement("h3", "", item.title), createElement("p", "", item.copy));
    notes.append(note);
  });

  target.replaceChildren(intro, notes);
};

const renderExpandable = (target, items, options = {}) => {
  target.replaceChildren(
    ...items.map((item, index) => {
      const details = createElement("details", options.compact ? "expand-card compact-card" : "expand-card");
      if (index === 0 && options.openFirst) details.open = true;

      const summary = createElement("summary");
      const marker = createElement("span", "expand-marker", item.label);
      const text = createElement("span", "expand-title");
      text.append(createElement("strong", "", item.title), createElement("small", "", item.summary));
      const icon = createElement("span", "expand-icon", "+");
      summary.append(marker, text, icon);

      const content = createElement("div", "expand-content");
      item.details.forEach((detail) => content.append(createElement("p", "", detail)));
      details.append(summary, content);
      return details;
    }),
  );
};

const renderProjectList = (target, dictionary) => {
  target.replaceChildren(
    ...dictionary.workbench.items.map((item, index) => {
      const button = createElement("button", "project-teaser");
      button.type = "button";
      button.dataset.projectId = item.id;
      button.append(
        createElement("span", "project-index", String(index + 1).padStart(2, "0")),
        createElement("span", "project-teaser-label", item.label),
        createElement("strong", "", item.title),
        createElement("p", "", item.summary),
        createElement("em", "", dictionary.workbench.open),
      );
      return button;
    }),
  );
};

const renderInternships = (target, dictionary) => {
  target.replaceChildren(
    ...dictionary.path.items.map((item) => {
      const article = createElement("article", "internship-item");
      article.append(
        createElement("span", "internship-date", item.label),
        createElement("strong", "", item.title),
        createElement("small", "", item.meta),
        createElement("p", "", item.summary),
      );
      return article;
    }),
  );
};

const renderToolkit = (target, dictionary) => {
  target.replaceChildren(
    ...dictionary.toolkit.items.map((item) => {
      const article = createElement("article", "toolkit-card");
      article.append(createElement("h3", "", item.title), createElement("p", "", item.copy));
      return article;
    }),
  );
};

const renderContact = (target, dictionary) => {
  target.replaceChildren(
    ...dictionary.contact.items.map((item) => {
      const row = createElement("a", "contact-row");
      row.href = item.href;
      row.append(createElement("span", "", item.label), createElement("strong", "", item.value));
      return row;
    }),
  );
};

const renderDynamicSections = (dictionary) => {
  renderTargets.forEach((target) => {
    const type = target.dataset.render;
    if (type === "about") renderAbout(target, dictionary);
    if (type === "workbench") renderProjectList(target, dictionary);
    if (type === "path") renderInternships(target, dictionary);
    if (type === "toolkit") renderToolkit(target, dictionary);
    if (type === "contact") renderContact(target, dictionary);
  });
};

const openProjectDetail = (projectId) => {
  const project = currentDictionary.workbench.items.find((item) => item.id === projectId);
  if (!project) return;
  activeProjectId = projectId;

  projectModalLabel.textContent = project.label;
  projectModalTitle.textContent = project.title;
  projectModalSummary.textContent = project.summary;
  projectModalBody.replaceChildren(
    ...project.details.map((detail) => {
      const paragraph = createElement("p", "", detail);
      return paragraph;
    }),
  );
  projectModal.classList.add("is-open");
  projectModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
};

const closeProjectDetail = () => {
  activeProjectId = undefined;
  projectModal.classList.remove("is-open");
  projectModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
};

const applyLanguage = (language) => {
  const dictionary = translations[language] ?? translations.zh;
  currentDictionary = dictionary;
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = dictionary.meta.title;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = getNestedValue(dictionary, element.dataset.i18n);
    if (value) element.textContent = value;
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
    element.dataset.i18nAttr.split(";").forEach((binding) => {
      const [attribute, key] = binding.split(":");
      const value = getNestedValue(dictionary, key);
      if (attribute && value) element.setAttribute(attribute, value);
    });
  });

  renderDynamicSections(dictionary);
  if (activeProjectId) openProjectDetail(activeProjectId);

  languageButtons.forEach((button) => {
    const isActive = button.dataset.language === language;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  localStorage.setItem("portfolio-language", language);
};

const getCurrentLanguage = () => {
  const savedLanguage = localStorage.getItem("portfolio-language");
  if (savedLanguage && translations[savedLanguage]) return savedLanguage;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
};

const syncHeader = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

syncHeader();
applyLanguage(getCurrentLanguage());
window.addEventListener("scroll", syncHeader, { passive: true });

hero.addEventListener("pointermove", (event) => {
  const bounds = hero.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
  document.body.style.setProperty("--pointer-x", `${x}%`);
  document.body.style.setProperty("--pointer-y", `${y}%`);
});

menuButton.addEventListener("click", () => {
  const isOpen = mobileNav.classList.toggle("is-open");
  const dictionary = translations[getCurrentLanguage()] ?? translations.zh;
  menuButton.setAttribute("aria-label", isOpen ? dictionary.nav.menuClose : dictionary.nav.menuOpen);
});

mobileNav.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    const dictionary = translations[getCurrentLanguage()] ?? translations.zh;
    mobileNav.classList.remove("is-open");
    menuButton.setAttribute("aria-label", dictionary.nav.menuOpen);
  }
});

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyLanguage(button.dataset.language);
  });
});

document.addEventListener("click", (event) => {
  const projectButton = event.target.closest("[data-project-id]");
  if (projectButton) {
    openProjectDetail(projectButton.dataset.projectId);
  }
});

projectCloseButtons.forEach((button) => {
  button.addEventListener("click", closeProjectDetail);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && projectModal.classList.contains("is-open")) {
    closeProjectDetail();
  }
});
