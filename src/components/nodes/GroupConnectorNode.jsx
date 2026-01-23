import { Handle, Position } from 'reactflow'
import { LABEL_BOX_HALF_WIDTH, LABEL_BOX_HALF_HEIGHT } from '../../constants'

// 그룹 연결용 보이지 않는 노드 (라벨박스 양 끝에 Handle만 표시)
const GroupConnectorNode = ({ data, id }) => {  

  console.log('data', data)
  // 확정 모드일 때만 Handle 표시
  const isConfirmed = data?.isConfirmed || false
  const handleTop = LABEL_BOX_HALF_HEIGHT // 45px (라벨박스 중앙)
  
  return (
    <div style={{ 
      width: '1px', 
      height: '1px', 
      position: 'relative',
      background: 'transparent',
      pointerEvents: 'none'
    }}>
      {/* 확정 모드일 때만 Handle 표시 */}
      {isConfirmed && (
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
              left: `calc(-${LABEL_BOX_HALF_WIDTH}px - 0.25rem)`,
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
              right: `calc(-${LABEL_BOX_HALF_WIDTH}px - 0.4rem)`,
            }}
          />
        </>
      )}
    </div>
  )
}

export default GroupConnectorNode
