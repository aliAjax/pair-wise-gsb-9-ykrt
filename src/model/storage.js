// 存储层：localStorage 读写、旧数据迁移、载入时校验自愈。
// 不包含界面与业务操作逻辑。

import { seedItems, migrateLegacyItem } from './data.js';
import { revalidateItem } from './anchor.js';

const KEY = 'research-library';

export const loadLibrary = () => {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(KEY));
  } catch {
    raw = null;
  }
  if (!Array.isArray(raw) || !raw.length) return seedItems;

  // 旧版条目（自由文本 notes、无 anchors）迁移为 legacy 锚点；
  // 再逐条按当前摘要重算锚点状态，保证版本、锚点、笔记重开后仍然对应。
  return raw.map((entry) => {
    const migrated = migrateLegacyItem(entry);
    const { item } = revalidateItem({
      abstractVersion: migrated.abstractVersion || 1,
      anchors: migrated.anchors || [],
      ...migrated,
    });
    return item;
  });
};

export const saveLibrary = (items) => {
  localStorage.setItem(KEY, JSON.stringify(items));
};
