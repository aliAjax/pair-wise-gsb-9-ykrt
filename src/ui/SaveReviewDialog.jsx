// 保存摘要前的核对框：先列出受影响的笔记。
// moved   原句仍在、位置变了 -> 跟随新位置
// missing 原句找不到 -> 进入待重定位，不自动移动；选取消则旧摘要与笔记原样保留
export default function SaveReviewDialog({ review, nextVersion, onConfirm, onCancel }) {
  const { moved, missing } = review;
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal review-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onCancel}>
          ×
        </button>
        <span className="crumb">REVIEW ANCHORS</span>
        <h2>保存后受影响的笔记</h2>
        <p className="review-sub">
          摘要将升为 v{nextVersion}。原句仍能找到的笔记继续锚在原句上；找不到的进入待重定位，不会自动挪位，处理完前仍可查。
        </p>

        {moved.length > 0 && (
          <div className="review-group">
            <h5>位置变化 · 跟随原句（{moved.length}）</h5>
            {moved.map((r) => (
              <div className="review-item" key={r.anchorId}>
                <span className="badge moved">跟随到第 {r.index + 1} 句</span>
                <blockquote>{r.quote}</blockquote>
                <small>{r.notes.length} 条文字笔记 · 引用 ×{r.noteCount}</small>
              </div>
            ))}
          </div>
        )}

        {missing.length > 0 ? (
          <div className="review-group">
            <h5>原句找不到 · 进入待重定位（{missing.length}）</h5>
            {missing.map((r) => (
              <div className="review-item" key={r.anchorId}>
                <span className="badge missing">待重定位</span>
                <blockquote>{r.quote}</blockquote>
                <small>{r.notes.length} 条文字笔记 · 引用 ×{r.noteCount}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="review-ok">没有笔记会失去锚点。</p>
        )}

        <div className="review-actions">
          <button className="outline" onClick={onCancel}>
            取消，返回修改
          </button>
          <button className="primary" onClick={onConfirm}>
            确认保存
          </button>
        </div>
      </div>
    </div>
  );
}
