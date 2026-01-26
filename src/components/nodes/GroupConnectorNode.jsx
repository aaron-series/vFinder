import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { LABEL_BOX_HALF_WIDTH, LABEL_BOX_HALF_HEIGHT } from '../../constants'

// 그룹 연결용 보이지 않는 노드 (라벨박스 양 끝에 Handle만 표시)
const GroupConnectorNode = ({ data, id }) => {

  const isConfirmed = data?.isConfirmed || false
  const isGroupBox = data?.isGroupBox || false
  const isHidden = data?.hidden || false
  const handleTop = LABEL_BOX_HALF_HEIGHT // 45px (라벨박스 중앙)

  // 숨겨진 경우 렌더링하지 않음
  if (isHidden) {
    return null
  }

  // Handle 표시 조건: 확정된 경우 또는 그룹박스인 경우
  const shouldShowHandles = (isConfirmed || isGroupBox) && !isHidden

  return (
    <div style={{
      width: '1px',
      height: '1px',
      position: 'relative',
      background: 'transparent',
      pointerEvents: 'none'
    }}>
      {/* 확정 모드이거나 그룹박스일 때 Handle 표시 */}
      {shouldShowHandles && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            isConnectable={true}
            style={{
              background: '#10b981',
              width: 14,
              height: 14,
              border: '2px solid white',
              zIndex: 1000,
              // 위치 조정 (기존 로직 참고)
              top: `${handleTop}px`,
              left: `calc(-${LABEL_BOX_HALF_WIDTH}px + 2.75rem)`,
            }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            isConnectable={true}
            style={{
              background: '#10b981',
              width: 14,
              height: 14,
              border: '2px solid white',
              zIndex: 1000,
              // 위치 조정
              top: `${handleTop}px`,
              right: `calc(-${LABEL_BOX_HALF_WIDTH}px - 3.45rem)`,
            }}
          />
        </>
      )}
    </div>
  )
}

// React.memo를 사용하여 props가 변경되지 않으면 리렌더링 방지
export default memo(GroupConnectorNode, (prevProps, nextProps) => {
  // id가 다르면 리렌더링 필요
  if (prevProps.id !== nextProps.id) {
    return false
  }

  // data 객체가 없으면 리렌더링 필요
  if (!prevProps.data || !nextProps.data) {
    return prevProps.data === nextProps.data
  }

  // data의 주요 속성들을 비교
  const prevData = prevProps.data
  const nextData = nextProps.data

  // 모든 중요한 속성이 동일하면 리렌더링하지 않음
  return (
    prevData.isConfirmed === nextData.isConfirmed &&
    prevData.isGroupBox === nextData.isGroupBox &&
    prevData.nodeId === nextData.nodeId &&
    prevData.groupId === nextData.groupId &&
    prevData.level === nextData.level &&
    prevData.hidden === nextData.hidden
  )
})
