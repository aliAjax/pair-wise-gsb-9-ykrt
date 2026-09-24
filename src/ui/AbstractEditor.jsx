// 界面层：摘要编辑弹窗，以及保存前列出受影响笔记的确认对话框。
import React, { useState } from 'react';

export function AbstractEditor({ entry, onSave, onClose }) {
  const [draft, setDraft] = useState(entry.abstract);
  return (
    <div className="modal-bg">
      <div className="modal">
        <button className="close" onClick={onClose}>×</button>
        <span className="crumb">ABSTRACT · 当前 v{entry.abstractVersion}</span>
        <h2>编辑摘要</h2>
        <p className="hint">
          笔记按原句精确锚定。保存后：原句仍在的笔记会跟随原句更新位置；找不到原句的笔记会进入「待重定位」，不会被自动挪动。
        </p>
        <textarea rows="6" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="row-end">
          <button className="outline" onClick={onClose}>取消</button>
          <button className="primary" onClick={() => onSave(draft)}>保存摘要</button>
        </div>
      </div>
    </div>
  );
}

// 保存摘要前弹出：列出所有将失去锚点的笔记，由用户确认后才落盘。
export function SavePlanDialog({ entry, plan, onConfirm, onCancel }) {
  return (
    <div className="modal-bg">
      <div className="modal">
        <span className="crumb">ABSTRACT v{entry.abstractVersion} → v{entry.abstractVersion + 1}</span>
        <h2>保存摘要</h2>
        <p className="plan-warn">
          新摘要中找不到以下 {plan.affected.length} 条笔记的原句。保存后它们会进入「待重定位」，内容与引用次数保留，
          处理完之前仍可查看；系统不会自动把它们挪到新位置。
        </p>
        <div className="plan-list">
          {plan.affected.map((n) => (
            <div className="plan-item" key={n.id}>
              <div className="plan-sentence">原句（v{n.abstractVersion} · #{n.sentenceIndex + 1}）：{n.sentence}</div>
              <div className="plan-text">
                {n.text}
                {n.refs > 1 ? `（摘录 ×${n.refs}）` : ''}
              </div>
            </div>
          ))}
        </div>
        {plan.reanchored.length > 0 && (
          <p className="plan-ok">其余 {plan.reanchored.length} 条笔记的原句仍在新摘要中，将跟随原句更新位置。</p>
        )}
        <div className="row-end">
          <button className="outline" onClick={onCancel}>取消</button>
          <button className="primary" onClick={onConfirm}>仍要保存</button>
        </div>
      </div>
    </div>
  );
}
