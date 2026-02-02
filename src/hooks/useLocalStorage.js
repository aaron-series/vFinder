import { useRef, useEffect, useCallback } from 'react'
import Swal from 'sweetalert2'
import { getKoreaTimeISOString } from '../utils'

/**
 * localStorage를 사용한 캔버스 상태 저장/복원 훅
 */
export const useLocalStorage = ({
  formData,
  patterns,
  nodes,
  edges,
  rfInstance,
  setNodes,
  setEdges,
  handleNodeEdit,
  handleNodeConfirm,
  handleNodeSettingsClick,
  handleNodeDelete,
  handleNodeStepChange
}) => {
  const isRestoredRef = useRef(false) // localStorage 복원 여부 추적

  // 저장 기능
  const handleSave = useCallback(async () => {
    // 현재 상태 수집
    // formData를 명시적으로 복사하여 저장 (모든 필드 포함)
    const savedFormData = {
      fileName: formData?.fileName || '',
      model: formData?.model || '',
      devStyle: formData?.devStyle || '',
      category: formData?.category || '',
      gender: formData?.gender || '',
      size: formData?.size || ''
    }

    const saveData = {
      version: '1.0.0',
      timestamp: getKoreaTimeISOString(),
      formData: savedFormData,
      patterns: patterns,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        draggable: node.draggable
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        data: edge.data,
        markerEnd: edge.markerEnd
      })),
      viewport: rfInstance ? rfInstance.getViewport() : null
    }

    // localStorage에 저장 (새로고침 후 복원용)
    try {
      localStorage.setItem('routing-tree-canvas-state', JSON.stringify({
        nodes: saveData.nodes,
        edges: saveData.edges,
        viewport: saveData.viewport,
        timestamp: saveData.timestamp
      }))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }

    // 성공 메시지 표시
    Swal.fire({
      title: 'Save Completed',
      text: `Changes saved successfully.`,
      icon: 'success',
      confirmButtonColor: '#1f2937',
      width: '380px',
      padding: '20px',
      timer: 1000,
      showConfirmButton: false
    })
  }, [formData, patterns, nodes, edges, rfInstance])

  // localStorage에서 캔버스 상태 복원 (rfInstance가 설정된 후, 한 번만 실행)
  useEffect(() => {
    if (!rfInstance || isRestoredRef.current) return

    try {
      const savedState = localStorage.getItem('routing-tree-canvas-state')
      if (savedState) {
        isRestoredRef.current = true
        const parsedState = JSON.parse(savedState)

        // nodes와 edges 복원 (저장된 좌표 그대로 사용)
        if (parsedState.nodes && Array.isArray(parsedState.nodes) && parsedState.nodes.length > 0) {
          // nodes의 핸들러 다시 연결 (partNode와 groupConnector 모두)
          const restoredNodes = parsedState.nodes.map(node => {
            if (node.type === 'partNode') {
              return {
                ...node,
                data: {
                  ...node.data,
                  // 핸들러 다시 연결
                  onSettingsClick: () => handleNodeSettingsClick(node.id),
                  onDelete: () => handleNodeDelete(node.id),
                  onStepChange: (id, val) => handleNodeStepChange(id, val),
                  onConfirm: () => handleNodeConfirm(node.id),
                  onEdit: () => handleNodeEdit(node.id),
                  onTextChange: (id, val) => {
                    setNodes(currentNodes => currentNodes.map(n => {
                      if (n.id === id) {
                        return {
                          ...n,
                          data: {
                            ...n.data,
                            text: val,
                            label: val
                          }
                        }
                      }
                      return n
                    }))
                  }
                }
              }
            } else if (node.type === 'groupConnector') {
              // groupConnector도 저장된 위치 그대로 복원 (핸들러만 다시 연결)
              return {
                ...node,
                data: {
                  ...node.data,
                  // 핸들러 다시 연결
                  onSettingsClick: () => handleNodeSettingsClick(node.id)
                }
              }
            }
            return node
          })
          setNodes(restoredNodes)
        }

        if (parsedState.edges && Array.isArray(parsedState.edges) && parsedState.edges.length > 0) {
          // edges의 핸들러 다시 연결
          const restoredEdges = parsedState.edges.map(edge => ({
            ...edge,
            data: {
              ...edge.data,
              // 핸들러 다시 연결
              onEdit: (edgeId) => handleNodeEdit(edgeId),
              onConfirm: (edgeId) => handleNodeConfirm(edgeId),
              onStepChange: (edgeId, value) => {
                setEdges((eds) =>
                  eds.map(e =>
                    e.id === edgeId
                      ? { ...e, data: { ...e.data, stepValue: value } }
                      : e
                  )
                )
              },
              onSettingsClick: (edgeId) => handleNodeSettingsClick(edgeId)
            }
          }))

          setEdges(restoredEdges)
        }

        // viewport 복원
        if (parsedState.viewport) {
          setTimeout(() => {
            rfInstance.setViewport(parsedState.viewport)
          }, 100)
        }
      }
    } catch (error) {
      console.error('Failed to restore from localStorage:', error)
    }
  }, [rfInstance, handleNodeEdit, handleNodeConfirm, handleNodeSettingsClick, handleNodeDelete, handleNodeStepChange, setNodes, setEdges, rfInstance])

  // localStorage 상태 제거
  const clearLocalStorage = useCallback(() => {
    try {
      localStorage.removeItem('routing-tree-canvas-state')
      isRestoredRef.current = false
    } catch (error) {
      console.error('Failed to remove canvas state from localStorage:', error)
    }
  }, [])

  return {
    handleSave,
    clearLocalStorage
  }
}
