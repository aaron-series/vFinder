import { MarkerType, EdgeLabelRenderer, BaseEdge, getSmoothStepPath } from 'reactflow'

// 커스텀 엣지 컴포넌트 (라벨 편집 가능)
const CustomEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }) => {
  // 그룹박스 편집과 일반 edge 편집을 구분
  const handleEditClick = () => {
    if (data?.isGroupLabel && data?.onGroupEdit) {
      // 그룹박스 편집
      data.onGroupEdit(id)
    } else if (data?.onEdit) {
      // 일반 edge 편집
      data.onEdit(id)
    }
  }
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // 라벨을 노드 사이 정중앙 하단에 배치
  const adjustedLabelY = Math.max(sourceY, targetY) + 180 // 노드 하단 기준으로 배치

  // 라벨 박스 상단까지의 연결선 (점선)
  const labelTopY = adjustedLabelY + 90 // 라벨 박스 상단 위치

  // 이 edge가 라벨 박스를 표시해야 하는지 확인
  const shouldShowLabel = data?.showLabel !== false

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={MarkerType.ArrowClosed}
        style={{
          stroke: selected ? '#1d4ed8' : '#2563eb',
          strokeWidth: selected ? 3 : 2,
        }}
      />
      {/* 라벨 박스를 표시해야 하는 경우에만 렌더링 */}
      {shouldShowLabel && (
        <>
          {/* 라벨 박스로 향하는 수직 연결선 */}
          <path
            d={`M ${labelX} ${labelY} L ${labelX} ${labelTopY}`}
            stroke={selected ? '#1d4ed8' : '#2563eb'}
            strokeWidth={selected ? 3 : 2}
            className="react-flow__edge-path edge-label-vertical-line"
            strokeDasharray="5,5"
            fill="none"
          />
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, 100%) translate(${labelX}px,${adjustedLabelY}px)`,
                pointerEvents: 'all',
              }}
              className="edge-label-box"
              data-edge-id={id}
              onClick={(e) => {
                e.stopPropagation()
                // 병합된 라벨박스는 그룹의 parent 역할
                // 클릭 시 연결된 모든 노드들의 설정 패널을 통합 관리
                if (data?.onSettingsClick) {
                  data.onSettingsClick(id)
                }
              }}
              title="그룹 설정 관리"
              data-confirmed={data?.isConfirmed}
            >
              {/* 제거 버튼 (좌측 상단) - 확정 상태가 아닐 때만 표시 */}
              {data?.onDelete && !data?.isConfirmed && (
                <button className="label-delete-btn" onClick={(e) => {
                  e.stopPropagation()
                  data.onDelete(id)
                }} title="연결 제거">
                  ×
                </button>
              )}
              <div className="node-step-header">
                <div className="node-step-label">{data?.step || 'STEP.'}</div>
                {/* 설정 버튼 (우측 상단) */}
                {data?.onSettingsClick && (
                  <button className="node-settings-btn" onClick={(e) => {
                    e.stopPropagation()
                    data.onSettingsClick(id)
                  }} title="설정">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="node-step-input-wrapper">
                <input
                  type="text"
                  value={data?.stepValue || ''}
                  onChange={(e) => data?.onStepChange && data.onStepChange(id, e.target.value)}
                  placeholder="Not yet selected process..."
                  className="node-step-input"
                  onClick={(e) => e.stopPropagation()}
                  readOnly={data?.isConfirmed}
                />
              </div>
              {/* 확정/편집 버튼 (좌측 하단) */}
              <div className="label-action-buttons">
                {!data?.isConfirmed ? (
                  <>
                    <button className="label-check-btn" onClick={(e) => {
                      e.stopPropagation()
                      if (data?.onConfirm) {
                        data.onConfirm(id)
                      }
                    }} title="확정">
                      <svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button className="label-edit-btn" onClick={(e) => {
                      e.stopPropagation()
                      handleEditClick()
                    }} title={data?.isGroupLabel ? "그룹 편집" : "편집"}>
                      <svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </EdgeLabelRenderer>
        </>
      )}
    </>
  )
}

export default CustomEdge
