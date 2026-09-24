import { useMemo, useState } from 'react';
import { splitSentences } from '../model/anchor.js';

// 待重定位：摘要改动后找不到原句的锚点，以及旧版自由文本笔记。
// 它们不会自动挪到新位置；处理完之前旧笔记仍然可查。
export default function PendingNotes({ item, onRelink, onRemove }) {
  const pending = (item.anchors || []).filter((a) => a.status !== 'anchored');
  const sentences = useMemo(() => splitSentences(item.abstract), [item.abstract]);
  const [pickingFor, setPickingFor] = useState(null);
  const [chosen, setChosen] = useState(0);

  if (!pending.length) return null;

  const startPick = (id) => {
    setPickingFor(id);
    setChosen(0);
  };

  return (
    <div className="detail-section pending-section">
      <h4>
        待重定位 <span>{pending.length} 条 · 旧笔记仍可查</span>
      </h4>
      <div className="pending-list">
        {pending.map((a) => (
          <div className={'pending-card ' + a.status} key={a.id}>
            <div className="pending-tag">
              {a.status === 'orphan' ? '原句已找不到' : '旧版笔记'}
            </div>
            {a.status === 'orphan' && a.quote && (
              <blockquote className="lost-quote">原句：{a.quote}</blockquote>
            )}
            <div className="pending-notes">
              {a.notes.map((n) => (
                <p key={n.id}>“{n.text}”</p>
              ))}
              {!a.notes.length && <p className="empty-line">摘录引用 ×{a.noteCount}（无文字笔记）</p>}
            </div>

            {pickingFor === a.id ? (
              <div className="relink-pick">
                <small>指定笔记归属到新摘要的哪一句（不会自动移动）：</small>
                <select value={chosen} onChange={(e) => setChosen(+e.target.value)}>
                  {sentences.map((s, i) => (
                    <option key={i} value={i}>
                      第 {i + 1} 句：{s.length > 40 ? s.slice(0, 40) + '…' : s}
                    </option>
                  ))}
                </select>
                <div className="panel-row">
                  <button className="mini" onClick={() => setPickingFor(null)}>
                    取消
                  </button>
                  <button
                    className="mini primary"
                    disabled={!sentences.length}
                    onClick={() => {
                      onRelink(a.id, sentences[chosen]);
                      setPickingFor(null);
                    }}
                  >
                    重定位到此句
                  </button>
                </div>
              </div>
            ) : (
              <div className="panel-row">
                <button className="mini" onClick={() => startPick(a.id)} disabled={!sentences.length}>
                  ↪ 手动重定位
                </button>
                <button className="mini danger" onClick={() => onRemove(a.id)}>
                  删除
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
