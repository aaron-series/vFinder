import { useCallback } from 'react'
import { EditorUtils } from '../helper'

/**
 * 엣지 관련 핸들러 훅
 */
export const useEdgeHandlers = ({
  setEdges,
  setNodes,
  setIsEdgeConfirmed,
  setShowSettingsPanel,
  setSelectedNodeId
}) => {
  // 엣지 삭제 핸들러
  const handleEdgeDelete = useCallback((edgeId) => {
    // 삭제되는 edge가 현재 설정패널에 열려있는 edge인지 확인
    setSelectedNodeId((currentSelectedId) => {
      if (currentSelectedId === edgeId) {
        // 설정패널 닫기
        setShowSettingsPanel(false)
        return null
      }
      return currentSelectedId
    })

    setEdges((eds) => {
      const edge = EditorUtils.findEdge(eds, edgeId)
      if (!edge) return eds

      // edge 삭제
      const updatedEdges = eds.filter((e) => e.id !== edgeId)

      // edge 삭제 후 연결된 노드들의 hasConnectedEdge 상태 업데이트 및 그룹 connector 정리
      setNodes((nds) => {
        // 먼저 노드의 hasConnectedEdge 상태 업데이트
        const updatedNodes = nds.map(node => {
          // source나 target 노드인 경우 hasConnectedEdge 재확인
          if (node.id === edge.source || node.id === edge.target) {
            const hasOtherEdges = updatedEdges.some(e =>
              e.source === node.id || e.target === node.id
            )
            return {
              ...node,
              data: {
                ...node.data,
                hasConnectedEdge: hasOtherEdges
              }
            }
          }
          return node
        })

        // 그룹 connector 정리: 삭제된 edge를 groupEdges에 포함하고 있는 connector 찾기
        const connectorsToRemove = []
        const connectorsToUpdate = []

        updatedNodes.forEach(node => {
          if (node && node.type === 'groupConnector' && node.data?.groupEdges) {
            const groupEdges = node.data.groupEdges
            // 삭제된 edge가 groupEdges에 포함되어 있는지 확인
            if (groupEdges.includes(edgeId)) {
              // groupEdges에서 삭제된 edge 제거
              const updatedGroupEdges = groupEdges.filter(eId => eId !== edgeId)

              // groupEdges가 비어지면 connector 삭제
              if (updatedGroupEdges.length === 0) {
                connectorsToRemove.push(node.id)
              } else {
                // groupEdges가 남아있으면 connector 업데이트
                connectorsToUpdate.push({
                  id: node.id,
                  updatedGroupEdges
                })
              }
            }
          }
        })

        // connector 삭제
        let finalNodes = updatedNodes.filter(node => !connectorsToRemove.includes(node.id))

        // 삭제되는 connector가 현재 설정패널에 열려있는지 확인
        if (connectorsToRemove.length > 0) {
          setSelectedNodeId((currentSelectedId) => {
            // 삭제되는 connector 중 하나가 현재 선택된 노드인지 확인
            const deletedConnectorIsSelected = connectorsToRemove.some(connectorId => {
              // currentSelectedId가 edge ID인 경우, 해당 edge가 삭제되는 connector와 관련이 있는지 확인
              if (currentSelectedId === edgeId) {
                return true
              }
              // currentSelectedId가 connector ID인 경우
              return currentSelectedId === connectorId
            })
            
            if (deletedConnectorIsSelected) {
              // 설정패널 닫기
              setShowSettingsPanel(false)
              return null
            }
            return currentSelectedId
          })
        }

        // connector 업데이트
        finalNodes = finalNodes.map(node => {
          const updateInfo = connectorsToUpdate.find(u => u.id === node.id)
          if (updateInfo) {
            return {
              ...node,
              data: {
                ...node.data,
                groupEdges: updateInfo.updatedGroupEdges
              }
            }
          }
          return node
        })

        return finalNodes
      })

      return updatedEdges
    })
  }, [setNodes, setEdges, setIsEdgeConfirmed, setShowSettingsPanel, setSelectedNodeId])

  return {
    handleEdgeDelete
  }
}
