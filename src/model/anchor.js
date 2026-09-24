// 校验层：摘要分句、句子归一化、锚点比对与状态判定。
// 全部是纯函数，不依赖数据层、存储或界面。

// 句末标点（含中英文）切分；标点保留在前一句，空白不单独成句。
export const splitSentences = (text) =>
  (text || '')
    .split(/(?<=[。！？!?\.])/)
    .map((s) => s.trim())
    .filter(Boolean);

// 匹配只看句子内容本身：去除所有空白，避免缩进、换行差异造成误判。
// 不做模糊匹配——改了字就是另一句，原锚点进入待重定位。
export const normalizeSentence = (s) => (s || '').replace(/\s+/g, '');

// 句索引 -> 该句在摘要正文中的字符区间（基于未切分的原文，便于高亮定位）。
export const locateSentences = (text) => {
  const ranges = [];
  const re = /[^。！？!?\.]*[。！？!?\.]?/g;
  let m;
  while ((m = re.exec(text || ''))) {
    const piece = m[0];
    const start = m.index;
    const end = start + piece.length;
    if (piece.trim()) ranges.push({ start, end, text: piece.trim() });
    if (!piece) break;
  }
  return ranges;
};

// 新摘要中逐锚点比对原句。
// matched        原句仍在（index 为新位置，moved 标记位置是否变化）
// matched=false  原句找不到 -> 待重定位，不自动挪位置
export const reviewAnchors = (item, nextText) => {
  const next = splitSentences(nextText);
  const normNext = next.map(normalizeSentence);
  const oldIndex = new Map();
  splitSentences(item.abstract).forEach((s, i) =>
    oldIndex.set(normalizeSentence(s), i)
  );

  const results = item.anchors
    .filter((a) => a.status !== 'legacy')
    .map((a) => {
      const key = normalizeSentence(a.quote);
      const index = normNext.indexOf(key);
      const found = index !== -1;
      return {
        anchorId: a.id,
        quote: a.quote,
        matched: found,
        moved: found && oldIndex.get(key) !== index,
        index: found ? index : -1,
        noteCount: a.noteCount,
        notes: a.notes,
      };
    });

  return {
    results,
    affected: results.filter((r) => !r.matched || r.moved),
    missing: results.filter((r) => !r.matched),
    moved: results.filter((r) => r.matched && r.moved),
  };
};

const matched = (i) => i !== -1;

// 重开页面后重算状态：版本文本与锚点状态必须对应。
// 返回 { item, changed }；legacy 锚点保持原样等待手动处理。
export const revalidateItem = (item) => {
  const normNext = splitSentences(item.abstract).map(normalizeSentence);
  let changed = false;
  const anchors = item.anchors.map((a) => {
    if (a.status === 'legacy') return a;
    const exists = normNext.includes(normalizeSentence(a.quote));
    const expected = exists ? 'anchored' : 'orphan';
    if (a.status !== expected) {
      changed = true;
      return { ...a, status: expected };
    }
    return a;
  });
  return { item: { ...item, anchors }, changed };
};

// 当前摘要上各句对应的锚点（同一句可有多个），供界面渲染高亮。
export const anchorsBySentence = (item) => {
  const map = new Map();
  for (const a of item.anchors || []) {
    if (a.status !== 'anchored') continue;
    const key = normalizeSentence(a.quote);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(a);
  }
  return map;
};
