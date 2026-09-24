// 数据层：文献条目、摘要版本、句子锚点与笔记的模型及纯数据操作。
// 不做任何校验判断（见 anchor.js），不接触存储（见 storage.js）与界面。

// 锚点状态：
// anchored 已锚定（quote 仍能在当前摘要中找到）
// orphan   待重定位（上次保存后原句找不到，锚点不自动移动）
// legacy   旧版自由文本笔记迁移而来，从未锚定
export const STATUS = { ANCHORED: 'anchored', ORPHAN: 'orphan', LEGACY: 'legacy' };

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const seedItems = [
  {
    id: 1,
    title: 'The Extended Mind',
    authors: 'Clark, A. & Chalmers, D.',
    year: 1998,
    venue: 'Analysis',
    tags: ['具身认知', '经典'],
    status: '阅读中',
    cite: 'Clark, A. & Chalmers, D. (1998). The Extended Mind. Analysis.',
    abstract:
      '本文提出心智延展论：当外部环境稳定地承担认知功能时，心智边界可以超越头脑与身体。',
    abstractVersion: 2,
    anchors: [
      {
        id: 'seed-note-1',
        status: STATUS.ANCHORED,
        quote: '当外部环境稳定地承担认知功能时，心智边界可以超越头脑与身体。',
        noteCount: 1,
        refs: [{ source: 'note', at: 1 }],
        notes: [
          {
            id: 'seed-note-1-n1',
            text: '关键在「稳定地承担」——临时用一下笔记本不算，持续可依赖才算。',
            createdAt: Date.now() - 86400000,
            updatedAt: Date.now() - 86400000,
          },
        ],
      },
    ],
  },
  {
    id: 2,
    title: 'Situated Learning',
    authors: 'Lave, J. & Wenger, E.',
    year: 1991,
    venue: 'Cambridge University Press',
    tags: ['学习科学', '社会'],
    status: '待读',
    cite: 'Lave, J. & Wenger, E. (1991). Situated Learning.',
    abstract: '学习发生在真实情境的参与过程中，知识与共同体实践不可分割。',
    abstractVersion: 1,
    anchors: [],
  },
  {
    id: 3,
    title: 'Designing with Data',
    authors: 'Miller, S.',
    year: 2022,
    venue: 'MIT Press',
    tags: ['设计研究', '方法'],
    status: '已读',
    cite: 'Miller, S. (2022). Designing with Data.',
    abstract: '一套面向设计师的数据研究方法，讨论如何把定性洞察转化为可行动的设计决策。',
    abstractVersion: 1,
    anchors: [],
  },
];

export const createItem = (form) => ({
  ...form,
  id: newId(),
  year: +form.year,
  tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean),
  status: '待读',
  cite: `${form.authors} (${form.year}). ${form.title}. ${form.venue}.`,
  abstractVersion: 1,
  anchors: [],
});

// 锚定到某句：已有锚点（含同一句的多个锚点）只累加引用计数；没有才新建。
// 同一句上重复摘录不产生新副本。
export const anchorAtSentence = (item, sentence, ref) => {
  const existing = item.anchors.find(
    (a) => a.status === STATUS.ANCHORED && a.quote === sentence
  );
  if (existing) {
    return {
      item: {
        ...item,
        anchors: item.anchors.map((a) =>
          a.id === existing.id
            ? { ...a, noteCount: a.noteCount + 1, refs: [...a.refs, ref] }
            : a
        ),
      },
      anchorId: existing.id,
      existed: true,
    };
  }
  const anchor = {
    id: newId(),
    status: STATUS.ANCHORED,
    quote: sentence,
    noteCount: 1,
    refs: [ref],
    notes: [],
  };
  return { item: { ...item, anchors: [...item.anchors, anchor] }, anchorId: anchor.id };
};

export const addNote = (item, anchorId, text) => {
  const now = Date.now();
  return {
    ...item,
    anchors: item.anchors.map((a) =>
      a.id === anchorId
        ? {
            ...a,
            notes: [
              ...a.notes,
              { id: newId(), text, createdAt: now, updatedAt: now },
            ],
          }
        : a
    ),
  };
};

export const updateNote = (item, anchorId, noteId, text) => ({
  ...item,
  anchors: item.anchors.map((a) =>
    a.id === anchorId
      ? {
          ...a,
          notes: a.notes.map((n) =>
            n.id === noteId ? { ...n, text, updatedAt: Date.now() } : n
          ),
        }
      : a
  ),
});

export const deleteNote = (item, anchorId, noteId) => ({
  ...item,
  anchors: item.anchors.map((a) =>
    a.id === anchorId ? { ...a, notes: a.notes.filter((n) => n.id !== noteId) } : a
  ),
});

// 处理「待重定位」：并入目标句上的锚点（笔记随迁、引用累加），不新建副本。
// 同一句上允许并存多个锚点（各自 quote 可能不同），因此不与目标句已有的
// 其他锚点合并；只在同 quote 锚点已存在时累加引用。
export const relinkAnchor = (item, anchorId, sentence) => {
  const orphan = item.anchors.find((a) => a.id === anchorId);
  if (!orphan) return item;
  const target = item.anchors.find(
    (a) =>
      a.id !== anchorId &&
      a.status === STATUS.ANCHORED &&
      a.quote === sentence
  );
  if (target) {
    return {
      ...item,
      anchors: item.anchors
        .filter((a) => a.id !== anchorId)
        .map((a) =>
          a.id === target.id
            ? {
                ...a,
                noteCount: a.noteCount + orphan.noteCount,
                refs: [...a.refs, ...orphan.refs],
                notes: [...a.notes, ...orphan.notes],
              }
            : a
        ),
    };
  }
  return {
    ...item,
    anchors: item.anchors.map((a) =>
      a.id === anchorId
        ? { ...a, status: STATUS.ANCHORED, quote: sentence }
        : a
    ),
  };
};

export const removeAnchor = (item, anchorId) => ({
  ...item,
  anchors: item.anchors.filter((a) => a.id !== anchorId),
});

// 提交一次摘要编辑：版本号递增，状态按校验结果落定（结果由 anchor.js 算出）。
export const commitAbstract = (item, text, review) => ({
  ...item,
  abstract: text,
  abstractVersion: (item.abstractVersion || 1) + 1,
  anchors: item.anchors.map((a) => {
    const r = review.results.find((x) => x.anchorId === a.id);
    if (!r) return a;
    return { ...a, status: r.matched ? STATUS.ANCHORED : STATUS.ORPHAN };
  }),
});

// 旧版条目（只有自由文本 notes）迁移：笔记保留为 legacy 锚点，仍可查，
// 等待用户在界面上手动指定原句。
export const migrateLegacyItem = (item) => {
  if (!item.notes || !String(item.notes).trim() || item.anchors) return item;
  const now = Date.now();
  return {
    ...item,
    abstractVersion: item.abstractVersion || 1,
    anchors: [
      {
        id: newId(),
        status: STATUS.LEGACY,
        quote: '',
        noteCount: 0,
        refs: [],
        notes: [
          { id: newId(), text: String(item.notes), createdAt: now, updatedAt: now },
        ],
      },
    ],
  };
};
