/**
 * Issue 01 · Spring 2026.
 *
 * Eight research questions that people working on AI Agents actually argue
 * about right now. Keep these opinionated and specific — the landing page
 * reads as a gazette of open problems, not as a feature list.
 *
 * Each question is phrased so that sending it to /chat returns something
 * opinionated rather than a wiki summary.
 */

export type IssueEntry = {
  id: string;
  ordinal: string; // editorial index, kept as zero-padded two-digit for display
  field: string; // short field label, rendered in smcp
  chineseField: string; // field label for the column head
  title: string; // single-line headline in Chinese
  question: string; // seed question sent to /chat on click
  dek: string; // 1–2 sentence framing in Chinese
  tension: string; // the short "why it is still open" note, italic in display
};

export const issues: IssueEntry[] = [
  {
    id: "safety",
    ordinal: "01",
    field: "safety",
    chineseField: "安全",
    title: "Agent 能在动手之前，自己察觉越界吗？",
    question: "Tool-augmented agents 怎么在调用之前就识别并拒绝被提示注入的指令？",
    dek: "工具越多，漏洞越多。间接提示注入让 Agent 被自己读到的网页教坏，比越狱更隐蔽。",
    tension: "检测往往滞后一次危险动作。",
  },
  {
    id: "memory",
    ordinal: "02",
    field: "memory",
    chineseField: "记忆",
    title: "让 Agent 记住一件事，要付出多少成本？",
    question: "长对话和多会话场景下，Agent 的长期记忆应该怎么设计？",
    dek: "向量库写得下，读不回来；摘要压得小，细节也压没了。长期记忆是压缩与召回之间的长期债务。",
    tension: "没有免费的记忆，只有不同形式的遗忘。",
  },
  {
    id: "tools",
    ordinal: "03",
    field: "tool use",
    chineseField: "工具",
    title: "该在什么时候，让 Agent 去用一个它没见过的工具？",
    question: "Agent 遇到新工具时，应该怎样决定是调用、改写，还是干脆绕开？",
    dek: "函数调用解决了协议，没解决判断。工具选择错了，再稳的协议也只是把错误送得更远。",
    tension: "调用不是能力的全部，取舍才是。",
  },
  {
    id: "multi-agent",
    ordinal: "04",
    field: "coordination",
    chineseField: "协作",
    title: "两个 Agent 谈判，真的比一个更聪明吗？",
    question: "什么样的多智能体协作机制，能在可审计的前提下真正超过单体？",
    dek: "多 Agent 常见的情况是：开销翻倍、错误也翻倍。真正的增量只在分歧能被调度时才出现。",
    tension: "合作不等于复数个独立系统的堆叠。",
  },
  {
    id: "planning",
    ordinal: "05",
    field: "planning",
    chineseField: "规划",
    title: "先想再做，和边做边想，哪种更划算？",
    question: "在任务预算有限时，Agent 应该优先投资在离线规划还是在线反思？",
    dek: "规划太长，窗口就挤满了假设；规划太短，每一步都像在赌博。中间那条线，其实取决于任务的可逆性。",
    tension: "可逆性，而不是复杂度，决定规划深度。",
  },
  {
    id: "eval",
    ordinal: "06",
    field: "evaluation",
    chineseField: "评测",
    title: "怎么衡量一个 Agent 真的在进步？",
    question: "对一个在线 Agent，怎么设计不会被刷分的、面向真实任务的评测？",
    dek: "公开榜单给出的曲线都很动人，真实任务的曲线常常抽风。会被刷分的指标，本质上就不是指标。",
    tension: "不是分数在进步，是它学会了被评。",
  },
  {
    id: "self",
    ordinal: "07",
    field: "self-improvement",
    chineseField: "自改进",
    title: "Agent 是在变强，还是只是学会讨好奖励？",
    question: "如何在 RLHF / 反思循环里分辨出真正的能力提升和 reward hacking？",
    dek: "奖励函数是老师，也是漏洞。会讨好奖励函数的 Agent，比真正会做事的 Agent 更便宜。",
    tension: "奖励越具体，越容易被绕开。",
  },
  {
    id: "world",
    ordinal: "08",
    field: "world models",
    chineseField: "世界",
    title: "Agent 需要一个“世界”才能真正行动吗？",
    question: "没有世界模型的 Agent，为什么在长时程任务上总会漂走？",
    dek: "没有内部世界，Agent 靠提示词勉强维持一致性。预测下一步的坐标，比预测下一段文字，难得不是一点。",
    tension: "没有模型的世界，只剩下回声。",
  },
];

export const issueMeta = {
  volume: "Vol. 01",
  number: "N°01",
  season: "Spring 2026",
  tagline: "问题在前，资料在后。",
};
