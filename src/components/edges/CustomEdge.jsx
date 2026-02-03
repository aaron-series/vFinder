import React, { useCallback } from 'react';
import { MarkerType, EdgeLabelRenderer, BaseEdge, getSmoothStepPath } from 'reactflow';

// --- Constants ---
const STYLES = {
  strokeSelected: '#1d4ed8',
  strokeDefault: '#2563eb',
  widthSelected: 3,
  widthDefault: 2,
  labelOffsetY: 180, // 노드 하단에서 라벨 박스까지의 거리
  dottedLineHeight: 90 // 점선 높이
};

// --- Helper Utilities ---
// 이벤트 버블링 방지 래퍼
const stopProp = (fn) => (e) => {
  e.stopPropagation();
  if (fn) fn(e);
};

// --- Sub-components (Internal) ---

// 1. 라벨 박스로 향하는 수직 점선
const VerticalLine = ({ x, startY, endY, selected }) => (
  <path
    d={`M ${x} ${startY} L ${x} ${endY}`}
    stroke={selected ? STYLES.strokeSelected : STYLES.strokeDefault}
    strokeWidth={selected ? STYLES.widthSelected : STYLES.widthDefault}
    className="react-flow__edge-path edge-label-vertical-line"
    strokeDasharray="5,5"
    fill="none"
  />
);

// 2. 공통 아이콘 버튼
const IconButton = ({ onClick, className, title, children }) => (
  <button className={className} onClick={stopProp(onClick)} title={title}>
    {children}
  </button>
);

// 3. 설정(기어) 아이콘 SVG
const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

// 4. 체크(확정) 아이콘 SVG
const CheckIcon = () => (
  <svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

// 5. 연필(편집) 아이콘 SVG
const EditIcon = () => (
  <svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);


// --- Main Component ---
const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}) => {
  // 경로 및 좌표 계산
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  // 라벨 박스 위치 계산 (노드들 중 더 아래쪽에 있는 노드 기준)
  const adjustedLabelY = Math.max(sourceY, targetY) + STYLES.labelOffsetY;
  const labelTopY = adjustedLabelY + STYLES.dottedLineHeight;

  // 렌더링 여부 확인
  const shouldShowLabel = data?.showLabel !== false;

  // 핸들러: 편집 버튼 클릭
  const onEditClick = useCallback(() => {
    if (data?.isGroupLabel && data?.onGroupEdit) {
      data.onGroupEdit(id);
    } else if (data?.onEdit) {
      data.onEdit(id);
    }
  }, [data, id]);

  // 핸들러: 라벨 박스 전체 클릭 (설정 진입)
  const onLabelBoxClick = useCallback(() => {
    if (data?.onSettingsClick) {
      data.onSettingsClick(id);
    }
  }, [data, id]);

  // 핸들러: 단계(Step) 값 변경
  const onInputChange = useCallback((e) => {
    if (data?.onStepChange) {
      data.onStepChange(id, e.target.value);
    }
  }, [data, id]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={MarkerType.ArrowClosed}
        style={{
          stroke: selected ? STYLES.strokeSelected : STYLES.strokeDefault,
          strokeWidth: selected ? STYLES.widthSelected : STYLES.widthDefault,
        }}
      />

      {shouldShowLabel && (
        <>
          {/* 1. 수직 점선 */}
          <VerticalLine 
            x={labelX} 
            startY={labelY} 
            endY={labelTopY} 
            selected={selected} 
          />

          {/* 2. 라벨 박스 및 컨트롤 */}
          <EdgeLabelRenderer>
            <div
              className="edge-label-box"
              data-edge-id={id}
              data-confirmed={data?.isConfirmed}
              title="그룹 설정 관리"
              onClick={stopProp(onLabelBoxClick)}
              style={{
                position: 'absolute',
                transform: `translate(-50%, 100%) translate(${labelX}px,${adjustedLabelY}px)`,
                pointerEvents: 'all',
              }}
            >
              {/* A. 제거 버튼 (미확정 상태일 때만) */}
              {data?.onDelete && !data?.isConfirmed && (
                <IconButton
                  className="label-delete-btn"
                  onClick={() => data.onDelete(id)}
                  title="연결 제거"
                >
                  ×
                </IconButton>
              )}

              {/* B. 헤더 (STEP 라벨 + 설정 버튼) */}
              <div className="node-step-header">
                <div className="node-step-label">{data?.step || 'STEP.'}</div>
                {data?.onSettingsClick && (
                  <IconButton
                    className="node-settings-btn"
                    onClick={() => data.onSettingsClick(id)}
                    title="설정"
                  >
                    <SettingsIcon />
                  </IconButton>
                )}
              </div>

              {/* C. 입력 필드 */}
              <div className="node-step-input-wrapper">
                <input
                  type="text"
                  className="node-step-input"
                  value={data?.stepValue || ''}
                  onChange={onInputChange}
                  onClick={stopProp(null)} // 입력 시 상위 클릭 방지
                  placeholder="Not yet selected process..."
                  readOnly={data?.isConfirmed}
                />
              </div>

              {/* D. 액션 버튼 (확정/편집) */}
              <div className="label-action-buttons">
                {!data?.isConfirmed ? (
                  <IconButton
                    className="label-check-btn"
                    onClick={() => data?.onConfirm && data.onConfirm(id)}
                    title="확정"
                  >
                    <CheckIcon />
                  </IconButton>
                ) : (
                  <IconButton
                    className="label-edit-btn"
                    onClick={onEditClick}
                    title={data?.isGroupLabel ? "그룹 편집" : "편집"}
                  >
                    <EditIcon />
                  </IconButton>
                )}
              </div>
            </div>
          </EdgeLabelRenderer>
        </>
      )}
    </>
  );
};

export default React.memo(CustomEdge);