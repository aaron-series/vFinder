import { useCallback } from 'react'
import { EditorUtils } from '../helper'
import { findAllConnectedPartNodes } from '../utils/groupHelpers'
import { INITIAL_SETTINGS_DATA } from '../constants'

/**
 * 노드/엣지 선택 및 설정 패널 처리 훅
 */
export const useSelectionHandler = ({
  setNodes,
  setEdges,
  setSelectedNodeId,
  setShowSettingsPanel,
  setIsEdgeConfirmed,
  setSettingsData,
  setAddedParts
}) => {

  const handleNodeSettingsClick = useCallback((nodeId) => {
    setNodes((currentNodes) => {
      setEdges((currentEdges) => {
        const targetEdge = EditorUtils.findEdge(currentEdges, nodeId)

        // 1. Edge(그룹 라벨) 클릭 시
        if (targetEdge) {
          setSelectedNodeId(nodeId)
          setShowSettingsPanel(true)

          // Edge 확정 상태 확인
          let isEdgeConfirmedState = targetEdge.data?.isConfirmed === true
          if (!isEdgeConfirmedState && targetEdge.data?.savedSettings?.connectorId) {
            const connector = currentNodes.find(n => n && n.id === targetEdge.data.savedSettings.connectorId)
            if (connector && connector.data?.isConfirmed === true) {
              isEdgeConfirmedState = true
            }
          }
          setIsEdgeConfirmed(isEdgeConfirmedState)

          // Saved Settings 적용
          if (targetEdge.data?.savedSettings && Object.keys(targetEdge.data.savedSettings).length > 0) {
            const { addedPartsIds, ...settingsData } = targetEdge.data.savedSettings
            setSettingsData(settingsData)

            if (addedPartsIds && Array.isArray(addedPartsIds)) {
              // const savedAddedParts = currentNodes.filter(n =>
              //   n && addedPartsIds.includes(n.id) && n.type === 'partNode'
              // )
              setAddedParts(addedPartsIds)
            } else {
              setAddedParts([])
            }
          } else {
            // [수정된 로직] 미확정 상태일 때 연결된 노드 정보로 Added Parts 복구
            setSettingsData(INITIAL_SETTINGS_DATA)
            
            const sourceNode = EditorUtils.findNode(currentNodes, targetEdge.source)
            const targetNode = EditorUtils.findNode(currentNodes, targetEdge.target)
            const partsToAdd = []

            if (sourceNode && (sourceNode.type === 'partNode' || sourceNode.type === 'groupConnector')) {
              partsToAdd.push(sourceNode)
            }
            if (targetNode && (targetNode.type === 'partNode' || targetNode.type === 'groupConnector')) {
              if (!partsToAdd.some(p => p.id === targetNode.id)) {
                partsToAdd.push(targetNode)
              }
            }
            setAddedParts(partsToAdd)
          }
          return currentEdges
        }

        // 2. Node 클릭 시
        const node = EditorUtils.findNode(currentNodes, nodeId)
        if (!node) return currentEdges

        setSelectedNodeId(nodeId)
        setShowSettingsPanel(true)
        setIsEdgeConfirmed(node.data?.isConfirmed === true)

        if (node.type === 'groupConnector') {
          // 그룹 커넥터
          if (node.data?.isConfirmed === true && node.data?.savedSettings?.addedPartsIds) {
             const { addedPartsIds, ...settingsData } = node.data.savedSettings
             setSettingsData(settingsData)
             const savedAddedParts = currentNodes.filter(n =>
               n && addedPartsIds.includes(n.id) && n.type === 'partNode'
             )
             setAddedParts(savedAddedParts)
          } else {
             const groupNodeIds = (node.data?.nodeIds || []).filter(id => !id.startsWith('edge-'))
             const groupPartNodes = currentNodes.filter(n =>
               n && n.type === 'partNode' && groupNodeIds.includes(n.id)
             )
             
             setSettingsData(node.data?.savedSettings || INITIAL_SETTINGS_DATA)
             setAddedParts(groupPartNodes || [])
          }
        } else {
          // 일반 파츠 노드
          const connectedPartNodes = findAllConnectedPartNodes(nodeId, currentNodes, currentEdges)
          setSettingsData(node.data?.savedSettings || INITIAL_SETTINGS_DATA)
          
          if (connectedPartNodes?.length > 0) {
            setAddedParts(connectedPartNodes)
          } else {
            setAddedParts([node])
          }
        }
        return currentEdges
      })
      return currentNodes
    })
  }, [setNodes, setEdges, setSelectedNodeId, setShowSettingsPanel, setIsEdgeConfirmed, setSettingsData, setAddedParts])

  return { handleNodeSettingsClick }
}