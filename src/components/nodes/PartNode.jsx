import { Handle, Position } from 'reactflow'

// 커스텀 노드 컴포넌트
const PartNode = ({ data, isConnectable, id }) => {
  const handleDelete = (e) => {
    e.stopPropagation()
    if (data.onDelete) {
      data.onDelete(id)
    }
  }

  const handleTextChange = (e) => {
    e.stopPropagation()
    if (data.onTextChange) {
      data.onTextChange(id, e.target.value)
    }
  }

  const handleSettingsClick = (e) => {
    e.stopPropagation()
    if (data.onSettingsClick) {
      data.onSettingsClick(id)
    } else {
      console.warn('onSettingsClick handler not found for node:', id, data)
    }
  }

  const handleStepChange = (e) => {
    e.stopPropagation()
    if (data.onStepChange) {
      data.onStepChange(id, e.target.value)
    }
  }

  // edge가 연결되어 있는지 확인 (source 또는 target으로 연결된 경우)
  const hasConnectedEdge = data.hasConnectedEdge || false

  // 확정 상태 확인
  const isConfirmed = data.isConfirmed || false

  return (
    <div className="custom-node-wrapper" data-text-node={data.isTextNode ? "true" : "false"} data-confirmed={isConfirmed ? "true" : "false"}>
      {/* 노드 번호 (우측 상단) */}
      <div className="node-number">{data.number || '1'}</div>

      {/* 제거 버튼 (좌측 상단) - 확정 상태가 아닐 때만 표시 */}
      {/* {!isConfirmed && (
        <button className="node-delete-btn" onClick={handleDelete} title="노드 제거">
          ×
        </button>
      )} */}

      {/* 노드 제목 영역 (상단 외부) */}
      <div className="node-title-wrapper">
        {data.isTextNode ? (
          <input
            type="text"
            className="node-title-input"
            value={data.label || ''}
            readOnly
            onClick={(e) => e.stopPropagation()}
            placeholder="Pattern Code"
          />
        ) : (
          <div className="node-title">{data.label}</div>
        )}
      </div>

      {/* 메인 노드 */}
      <div className="custom-node">
        {/* 상단 핸들 (입력) */}
        {/* <Handle
          type="target"
          position={Position.Top}
          id="top"
          isConnectable={true}
          style={{ 
            background: isConfirmed ? '#10b981' : '#2563eb', 
            width: 18, 
            height: 18,
            top: '-50px',
            opacity: isConfirmed ? 1 : 1,
            pointerEvents: 'all'
          }}
        /> */}

        {/* 좌측 핸들 (입력) */}
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          isConnectable={true}
          style={{
            background: isConfirmed ? '#10b981' : '#2563eb',
            width: 18,
            height: 18,
            left: '-10px',
            opacity: isConfirmed ? 1 : 1,
            pointerEvents: 'all'
          }}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left-source"
          isConnectable={true}
          style={{
            background: isConfirmed ? '#10b981' : '#2563eb',
            width: 18,
            height: 18,
            top:'55%',
            left: '-10px',
            opacity: 0,
            pointerEvents: 'all'
          }}
        />

        <div className="node-thumbnail">
          {data.isTextNode ? (
            <div className="node-text-input-wrapper">
              <textarea
                className="node-text-input"
                value={data.text || ''}
                onChange={handleTextChange}
                onClick={(e) => e.stopPropagation()}
                placeholder="Enter text..."
                rows={4}
                readOnly={isConfirmed}
              />
            </div>
          ) : data.thumbnail ? (
            <img
              src={data.thumbnail}
              alt={data.label}
              className="node-thumbnail-image"
            />
          ) : (
            <svg width="100%" height="100%" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M30 60 L60 30 L90 60 L60 90 Z" stroke="#2563eb" strokeWidth="2" fill="none" />
            </svg>
          )}
        </div>

        {/* 우측 핸들 (출력) */}
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          isConnectable={true}
          style={{
            background: isConfirmed ? '#10b981' : '#2563eb',
            width: 18,
            height: 18,
            right: '-10px',
            opacity: isConfirmed ? 1 : 1,
            pointerEvents: 'all'
          }}
        />
        <Handle
          type="target"
          position={Position.Right}
          id="right-target"
          isConnectable={true}
          style={{
            background: isConfirmed ? '#10b981' : '#2563eb',
            width: 18,
            height: 18,
            right: '-10px',
            top: '55%',
            opacity: 0,
            pointerEvents: 'all'
          }}
        />

        {/* 하단 핸들 (출력) */}
        {/* <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          isConnectable={true}
          style={{ 
            background: isConfirmed ? '#10b981' : '#2563eb', 
            width: 14, 
            height: 14,
            opacity: isConfirmed ? 1 : 1,
            pointerEvents: 'all'
          }}
        /> */}
      </div>

      {/* 노드 하단 라벨 박스 - edge가 연결되지 않았을 때만 표시 */}
      {!hasConnectedEdge && (
        <div className="node-label-box" data-node-id={id} onClick={handleSettingsClick}>
          {/* 제거 버튼 (좌측 상단) - 확정 상태가 아닐 때만 표시 */}
          {!isConfirmed && (
            <button className="label-delete-btn" onClick={handleDelete} title="노드 제거">
              ×
            </button>
          )}
          <div className="node-step-header">
            <div className="node-step-label">{data.step || 'STEP.'}</div>
            {/* 설정 버튼 (우측 상단) */}
            <button className="node-settings-btn" onClick={handleSettingsClick} title="설정">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="node-step-input-wrapper" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={data.stepValue || ''}
              onChange={handleStepChange}
              placeholder="Not yet selected process..."
              className="node-step-input"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              readOnly={isConfirmed}
            />
          </div>
          {/* 확정/편집 버튼 (좌측 하단) */}
          <div className="label-action-buttons">
            {!isConfirmed ? (
              <>
                <button className="label-check-btn" onClick={(e) => {
                  e.stopPropagation()
                  if (data.onConfirm) {
                    data.onConfirm(id)
                  }
                }} title="확정">
                  <svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </>
            ) : (
              <button className="label-edit-btn" onClick={(e) => {
                e.stopPropagation()
                if (data.onEdit) {
                  data.onEdit(id)
                }
              }} title="편집">
                <svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PartNode
