import { useCallback, useState } from 'react'
import { EditorUtils } from '../helper'
import { NODE_WIDTH, NODE_HEIGHT } from '../constants'

/**
 * 드래그 앤 드롭 관련 훅
 */
export const useDragAndDrop = ({
  nodes,
  setNodes,
  rfInstance,
  nodeWidth,
  nodeHeight,
  handleNodeSettingsClick,
  handleNodeDelete,
  handleNodeStepChange,
  handleNodeConfirm,
  handleNodeEdit
}) => {
  const [draggedPart, setDraggedPart] = useState(null)

  // 파츠 드래그 시작 핸들러
  const onPartDragStart = useCallback((e, part) => {
    setDraggedPart(part)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  // 캔버스에 드롭 핸들러
  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      if (!draggedPart || !rfInstance) return

      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const isTextPart = draggedPart.isTextPart || false
      // 드롭 위치 보정 (중앙 정렬)
      position.x -= (isTextPart ? 400 : nodeWidth) / 2
      position.y -= nodeHeight / 2
      
      // 노드 ID 생성 (현재 nodes 상태 사용)
      const newNodeId = EditorUtils.createNodeId(nodes)

      setNodes((nds) => {
        // 파츠 노드만 필터링 (groupConnector 제외)
        const partNodes = nds.filter(n => n && n.type === 'partNode')
        const newNumber = partNodes.length + 1
      
        const newNode = {
          id: newNodeId,
          type: 'partNode',
          position,
          draggable: true,
          data: { 
            label: isTextPart ? '' : draggedPart.code,
            number: newNumber, // 현재 파츠 노드 개수 + 1
            isLastNode: true,
            thumbnail: draggedPart.thumbnail,
            isTextNode: isTextPart,
            text: isTextPart ? '' : undefined,
            step: 'STEP.',
            stepValue: '',
            hasConnectedEdge: false,
            isConfirmed: false,
            // 핸들러 연결
            onSettingsClick: () => handleNodeSettingsClick(newNodeId),
            onDelete: () => handleNodeDelete(newNodeId),
            onStepChange: (id, val) => handleNodeStepChange(id, val),
            onConfirm: () => handleNodeConfirm(newNodeId),
            onEdit: () => handleNodeEdit(newNodeId),
            // 텍스트 변경 등 추가 핸들러 필요 시 연결
            // 텍스트 입력 시 패턴코드(label)도 자동으로 업데이트
            onTextChange: (id, val) => {
              setNodes(currentNodes => currentNodes.map(n => {
                if (n.id === id) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      text: val,
                      label: val // 패턴코드도 자동으로 업데이트
                    }
                  }
                }
                return n
              }))
            }
          },
        }

        // 기존 노드들의 isLastNode false 처리
        const updatedNodes = nds.map(node => ({
          ...node,
          data: { ...node.data, isLastNode: false }
        }))
        return [...updatedNodes, newNode]
      })
      
      // 생성 직후 설정 패널 열기
      setTimeout(() => {
        handleNodeSettingsClick(newNodeId)
      }, 100)
      
      setDraggedPart(null)
    },
    [draggedPart, rfInstance, nodes.length, setNodes, handleNodeSettingsClick, handleNodeDelete, handleNodeStepChange, handleNodeConfirm, handleNodeEdit, nodeWidth, nodeHeight]
  )

  // 드래그 오버 핸들러
  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  return {
    onPartDragStart,
    onDrop,
    onDragOver
  }
}
