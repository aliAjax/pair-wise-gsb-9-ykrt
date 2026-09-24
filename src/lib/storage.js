// 存储层：localStorage 读写、版本迁移与种子数据。不依赖界面。
import { normalizeState, migrateV1, SCHEMA_VERSION } from './validate.js';

const KEY = 'research-library-v2';
const LEGACY_KEY = 'research-library';

const T0 = 1790208000000; // 2026-09-24 前后，仅用于种子数据时间戳

const seed = {
  schema: SCHEMA_VERSION,
  items: [
    {
      id: 1,
      title: 'The Extended Mind',
      authors: 'Clark, A. & Chalmers, D.',
      year: 1998,
      venue: 'Analysis',
      tags: ['具身认知', '经典'],
      abstract: '本文提出心智延展论：当外部环境稳定地承担认知功能时，心智边界可以超越头脑与身体。',
      abstractVersion: 2,
      status: '阅读中',
      cite: 'Clark, A. & Chalmers, D. (1998). The Extended Mind. Analysis.',
    },
    {
      id: 2,
      title: 'Situated Learning',
      authors: 'Lave, J. & Wenger, E.',
      year: 1991,
      venue: 'Cambridge University Press',
      tags: ['学习科学', '社会'],
      abstract: '学习发生在真实情境的参与过程中，知识与共同体实践不可分割。',
      abstractVersion: 1,
      status: '待读',
      cite: 'Lave, J. & Wenger, E. (1991). Situated Learning.',
    },
    {
      id: 3,
      title: 'Designing with Data',
      authors: 'Miller, S.',
      year: 2022,
      venue: 'MIT Press',
      tags: ['设计研究', '方法'],
      abstract: '一套面向设计师的数据研究方法，讨论如何把定性洞察转化为可行动的设计决策。',
      abstractVersion: 1,
      status: '已读',
      cite: 'Miller, S. (2022). Designing with Data.',
    },
  ],
  notes: [
    {
      id: 'note-seed-1',
      entryId: 1,
      status: 'anchored',
      sentence: '本文提出心智延展论：当外部环境稳定地承担认知功能时，心智边界可以超越头脑与身体。',
      sentenceIndex: 0,
      abstractVersion: 2,
      text: '心智边界的判据值得单独讨论。',
      refs: 2,
      createdAt: T0 - 86400000 * 3,
      updatedAt: T0 - 86400000,
    },
    {
      id: 'note-seed-2',
      entryId: 1,
      status: 'anchored',
      sentence: '本文提出心智延展论：当外部环境稳定地承担认知功能时，心智边界可以超越头脑与身体。',
      sentenceIndex: 0,
      abstractVersion: 2,
      text: '与具身认知纲领对照阅读。',
      refs: 1,
      createdAt: T0 - 86400000 * 2,
      updatedAt: T0 - 86400000 * 2,
    },
    {
      id: 'note-seed-3',
      entryId: 1,
      status: 'pending',
      sentence: '认知耦合被视为心智延展的充分条件。',
      sentenceIndex: 1,
      abstractVersion: 1,
      text: '修订版摘要删去了这一论断，需要决定是否保留。',
      refs: 1,
      createdAt: T0 - 86400000 * 5,
      updatedAt: T0 - 86400000 * 2,
    },
    {
      id: 'note-seed-4',
      entryId: 2,
      status: 'anchored',
      sentence: '学习发生在真实情境的参与过程中，知识与共同体实践不可分割。',
      sentenceIndex: 0,
      abstractVersion: 1,
      text: '“参与”是这里的核心概念。',
      refs: 1,
      createdAt: T0 - 86400000 * 4,
      updatedAt: T0 - 86400000 * 4,
    },
    {
      id: 'note-seed-5',
      entryId: 3,
      status: 'entry',
      sentence: null,
      sentenceIndex: null,
      abstractVersion: null,
      text: '第三章的设计决策清单可以复用到课题里。',
      refs: 1,
      createdAt: T0 - 86400000 * 6,
      updatedAt: T0 - 86400000 * 6,
    },
  ],
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const { state, issues } = normalizeState(JSON.parse(raw));
      issues.forEach((m) => console.warn('[library]', m));
      return state;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const { state, issues } = normalizeState(migrateV1(JSON.parse(legacy)));
      issues.forEach((m) => console.warn('[library] 已迁移旧版数据：', m));
      saveState(state);
      return state;
    }
  } catch (err) {
    console.warn('[library] 读取本地数据失败，改用种子数据', err);
  }
  return normalizeState(seed).state;
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[library] 保存失败', err);
  }
}
