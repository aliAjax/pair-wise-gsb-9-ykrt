// 校验层：状态形状校验、锚点一致性修复与 v1 → v2 迁移。只依赖数据层。
import { NOTE_STATUS, splitSentences, locateSentence, uid } from './model.js';

export const SCHEMA_VERSION = 2;

const STATUS_SET = new Set(Object.values(NOTE_STATUS));

export const emptyState = () => ({ schema: SCHEMA_VERSION, items: [], notes: [] });

// 把任意输入修整为合法状态；无法修复的记录被丢弃并记录原因。
export function normalizeState(raw) {
  const issues = [];
  const state = emptyState();
  if (!raw || typeof raw !== 'object') {
    issues.push('本地数据不是有效对象，已重置为空库');
    return { state, issues };
  }

  const seen = new Set();
  state.items = (Array.isArray(raw.items) ? raw.items : []).flatMap((it, i) => {
    if (!it || typeof it !== 'object' || !String(it.title ?? '').trim()) {
      issues.push(`第 ${i + 1} 条文献缺少标题，已丢弃`);
      return [];
    }
    const id = it.id ?? uid('item');
    if (seen.has(id)) {
      issues.push(`文献 id「${id}」重复，已丢弃重复项`);
      return [];
    }
    seen.add(id);
    return [
      {
        id,
        title: String(it.title).trim(),
        authors: String(it.authors ?? ''),
        year: Number.isFinite(+it.year) ? +it.year : '',
        venue: String(it.venue ?? ''),
        tags: Array.isArray(it.tags) ? it.tags.map((t) => String(t).trim()).filter(Boolean) : [],
        abstract: String(it.abstract ?? ''),
        abstractVersion: Number.isInteger(it.abstractVersion) && it.abstractVersion >= 1 ? it.abstractVersion : 1,
        status: String(it.status ?? '待读'),
        cite: String(it.cite ?? ''),
      },
    ];
  });

  const byId = new Map(state.items.map((x) => [x.id, x]));
  state.notes = (Array.isArray(raw.notes) ? raw.notes : []).flatMap((n, i) => {
    if (!n || typeof n !== 'object' || !byId.has(n.entryId)) {
      issues.push(`第 ${i + 1} 条笔记找不到所属文献，已丢弃`);
      return [];
    }
    const text = String(n.text ?? '').trim();
    if (!text) {
      issues.push(`第 ${i + 1} 条笔记内容为空，已丢弃`);
      return [];
    }
    let status = STATUS_SET.has(n.status) ? n.status : n.sentence ? NOTE_STATUS.PENDING : NOTE_STATUS.ENTRY;
    const isEntry = status === NOTE_STATUS.ENTRY || n.sentence == null;
    if (isEntry) status = NOTE_STATUS.ENTRY;
    return [
      {
        id: n.id ?? uid('note'),
        entryId: n.entryId,
        status,
        sentence: isEntry ? null : String(n.sentence),
        sentenceIndex: isEntry ? null : Number.isInteger(n.sentenceIndex) && n.sentenceIndex >= 0 ? n.sentenceIndex : 0,
        abstractVersion: isEntry ? null : Number.isInteger(n.abstractVersion) && n.abstractVersion >= 1 ? n.abstractVersion : 1,
        text,
        refs: Number.isInteger(n.refs) && n.refs >= 1 ? n.refs : 1,
        createdAt: Number.isFinite(+n.createdAt) ? +n.createdAt : Date.now(),
        updatedAt: Number.isFinite(+n.updatedAt) ? +n.updatedAt : Date.now(),
      },
    ];
  });

  reconcileAnchors(state, issues);
  return { state, issues };
}

// 不变量：anchored 笔记的原句必须存在于所属文献的当前摘要中。
// 原句仍在 → 校正位置与版本号；原句不在 → 降级为待重定位。
// 保留原句快照，绝不自动把笔记改锚到别的句子。
export function reconcileAnchors(state, issues = []) {
  const byId = new Map(state.items.map((x) => [x.id, x]));
  for (const n of state.notes) {
    if (n.status !== NOTE_STATUS.ANCHORED) continue;
    const entry = byId.get(n.entryId);
    if (!entry) continue;
    const sentences = splitSentences(entry.abstract);
    const idx = locateSentence(sentences, n.sentence, n.sentenceIndex);
    if (idx >= 0) {
      if (idx !== n.sentenceIndex || n.abstractVersion !== entry.abstractVersion) {
        issues.push(`笔记「${n.text.slice(0, 12)}」的锚点已校正到 v${entry.abstractVersion} #${idx + 1}`);
        n.sentenceIndex = idx;
        n.abstractVersion = entry.abstractVersion;
      }
    } else {
      issues.push(`笔记「${n.text.slice(0, 12)}」的原句不在当前摘要中，已标记为待重定位`);
      n.status = NOTE_STATUS.PENDING;
    }
  }
  return state;
}

// v1 数据：localStorage 中的文献数组，笔记是条目上的自由文本字段。
// 迁移为 v2：摘要版本从 1 开始，旧的整篇笔记文本转为不锚定句子的整篇笔记。
export function migrateV1(legacy) {
  const items = Array.isArray(legacy) ? legacy : [];
  const notes = [];
  const migrated = items.map((it) => {
    const { notes: freeText, ...rest } = it || {};
    if (freeText && String(freeText).trim()) {
      notes.push({
        id: uid('note'),
        entryId: it.id,
        status: NOTE_STATUS.ENTRY,
        sentence: null,
        sentenceIndex: null,
        abstractVersion: null,
        text: String(freeText).trim(),
        refs: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return { ...rest, abstractVersion: 1 };
  });
  return { schema: SCHEMA_VERSION, items: migrated, notes };
}
