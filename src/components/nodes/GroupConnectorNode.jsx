import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { LABEL_BOX_HALF_WIDTH, LABEL_BOX_HALF_HEIGHT } from '../../constants'

// 그룹 연결용 보이지 않는 노드 (라벨박스 양 끝에 Handle만 표시)
const GroupConnectorNode = ({ data, id }) => {

  const isConfirmed = data?.isConfirmed || false
  const isGroupBox = data?.isGroupBox || false
  const isHidden = data?.hidden || false
  const isGroupToGroup = data?.isGroupToGroup || false // 그룹과 그룹 연결로 생성된 경우
  const handleTop = LABEL_BOX_HALF_HEIGHT // 45px (라벨박스 중앙)
  const targetRingSize = 32 // 24에서 32로 증가 (연결 영역 확대)
  const sourceHandleSize = 22 // 18에서 22로 증가 (연결 영역 확대)
  const targetRingOffset = (targetRingSize - sourceHandleSize) / 2 // 5px

  // 숨겨진 경우 렌더링하지 않음 (단, 그룹과 그룹 연결로 생성된 경우는 예외)
  if (isHidden && !isGroupToGroup) {
    return null
  }

  // Handle 표시 조건: 확정된 경우 또는 그룹과 그룹 연결로 생성된 경우 표시
  const shouldShowHandles = (isConfirmed || isGroupToGroup) && !(isHidden && !isGroupToGroup)
  // console.log('★[shouldShowHandles]: ', shouldShowHandles, 'isConfirmed:', isConfirmed, 'isGroupBox:', isGroupBox, 'isGroupToGroup:', isGroupToGroup, 'isHidden:', isHidden)

  // 단일 노드 커넥터인지 확인 (isGroupBox가 false이고 nodeId가 있으면 단일 노드 커넥터)
  const isSingleNodeConnector = !isGroupBox && data?.nodeId

  return (
    <div style={{
      width: '1px', // 단일 노드 커넥터는 handle을 위한 공간 확보
      height: '1px',
      position: 'relative',
      background: 'transparent',
      pointerEvents: 'none'
    }}>
      {/* 확정 모드이거나 그룹박스일 때 Handle 표시 */}
      {shouldShowHandles && (
        <>
          {isSingleNodeConnector ? (
            <>
              {/* 단일 노드 커넥터: group-to-group 연결을 위한 target handle (ring) */}
              <Handle
                type="target"
                position={Position.Bottom}
                id="bottom-target"
                isConnectable={true}
                style={{
                  background: 'transparent',
                  width: targetRingSize,
                  height: targetRingSize,
                  border: '2px dashed #10b981',
                  zIndex: 999,
                  pointerEvents: 'all',
                  cursor: 'crosshair',
                  top: `calc(${handleTop * 1.3}px - ${targetRingOffset}px)`,
                  left: `calc(${LABEL_BOX_HALF_WIDTH / 2.8}px - 1px`,
                }}
              />
              {/* 단일 노드 커넥터: source handle */}
              <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                isConnectable={true}
                style={{
                  background: '#10b981',
                  width: sourceHandleSize,
                  height: sourceHandleSize,
                  border: '2px solid white',
                  zIndex: 1000,
                  pointerEvents: 'all',
                  cursor: 'crosshair',
                  top: `${handleTop * 1.3}px`,
                  left: `${LABEL_BOX_HALF_WIDTH / 2.8}px`,
                }}
              />
            </>
          ) : (
            <>
              {/* 그룹박스 커넥터: group-to-group 연결을 위한 target handle (ring) */}
              <Handle
                type="target"
                position={Position.Bottom}
                id="bottom-target"
                isConnectable={true}
                style={{
                  background: 'transparent',
                  width: targetRingSize,
                  height: targetRingSize,
                  border: '2px dashed #10b981',
                  zIndex: 999,
                  pointerEvents: 'all',
                  cursor: 'crosshair',
                  top: `calc(${-handleTop / 15}px - ${targetRingOffset}px)`,
                  left: `calc(${LABEL_BOX_HALF_WIDTH / 40}px - ${targetRingOffset}px) + 3px`,
                }}
              />
              {/* 그룹박스 커넥터: source handle */}
              <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                isConnectable={true}
                style={{
                  background: '#10b981',
                  width: sourceHandleSize,
                  height: sourceHandleSize,
                  border: '2px solid white',
                  zIndex: 1000,
                  pointerEvents: 'all',
                  cursor: 'crosshair',
                  top: `${-handleTop / 15}px`,
                  left: `${LABEL_BOX_HALF_WIDTH / 40}px - 10px`,
                }}
              />
            </>
          )}
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
    prevData.hidden === nextData.hidden &&
    prevData.isGroupToGroup === nextData.isGroupToGroup
  )
})
