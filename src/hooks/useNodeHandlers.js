import { useCallback, useRef } from 'react'
import { addEdge, MarkerType } from 'reactflow'
import { EditorUtils } from '../helper'
import { showSmallAlert } from '../utils'
import { updateEdgeLabels } from '../services/edgeLabelService'
import { calculateConnectorPosition } from '../services/connectorService'
import { isMatchingConnector, hideChildGroupConnectors, findGroupConnector } from '../utils/nodeHelpers'
import { NODE_HEIGHT } from '../constants'

/**
 * 노드 관련 핸들러 훅
 * - 노드 값 변경, 삭제, 편집, 확정, 드래그 등의 상호작용을 처리합니다.
 */
export const useNodeHandlers = ({
  nodes,
  edges,
  setNodes,
  setEdges,
  rfInstance,
  settingsDataRef,
  addedPartsRef,
  confirmingRef,
  setIsEdgeConfirmed,
  setShowSettingsPanel,
  setFocusField,
  setSelectedNodeId,
  setAddedParts,
  setSettingsData,
  handleEdgeDelete,
  handleNodeSettingsClick,
  calculateConnectorPositionCallback,
  updateEdgeLabelsCallback
}) => {
  // 드래그 중인 그룹 정보 추적
  const draggingGroupRef = useRef(null)
  // 순환 참조 방지용 Ref
  const handleNodeEditRef = useRef(null)
  const handleNodeConfirmRef = useRef(null)

  // =========================================================================================
  // 1. 단순 값 변경 핸들러
  // =========================================================================================

  // 노드 Step Value (입력값) 변경 핸들러
  const handleNodeStepChange = useCallback((id, value) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, stepValue: value } }
        }
        return node
      })
    )
  }, [setNodes])

  // =========================================================================================
  // 2. 삭제 핸들러
  // =========================================================================================

  const handleNodeDelete = useCallback((id) => {
    // 삭제되는 노드가 현재 설정패널에 열려있는지 확인하고 패널 닫기
    setSelectedNodeId((currentSelectedId) => {
      if (currentSelectedId === id) {
        setShowSettingsPanel(false)
        return null
      }
      return currentSelectedId
    })

    setNodes((nds) => {
      // 1. 그룹 커넥터 삭제 시 관련 Edge 및 선택 상태 처리
      const nodeToDelete = EditorUtils.findNode(nds, id)
      if (nodeToDelete && nodeToDelete.type === 'groupConnector') {
        setEdges((eds) => {
          const relatedEdges = eds.filter(edge => {
            // savedSettings에 connectorId가 있는 경우
            if (edge.data?.savedSettings?.connectorId === id) {
              return true
            }
            // groupEdges에 포함된 경우 (fallback)
            return false
          })

          // 관련 edge가 선택되어 있었다면 패널 닫기
          if (relatedEdges.length > 0) {
            setSelectedNodeId((currentSelectedId) => {
              const hasSelectedEdge = relatedEdges.some(edge => edge.id === currentSelectedId)
              if (hasSelectedEdge) {
                setShowSettingsPanel(false)
                return null
              }
              return currentSelectedId
            })
          }
          return eds
        })
      }

      // 2. 노드 삭제 수행
      const filteredNodes = nds.filter((node) => node.id !== id)

      // 3. 파츠 노드 번호(number) 재정렬
      const partNodes = filteredNodes.filter(n => n && n.type === 'partNode')
      const updatedNodes = filteredNodes.map(node => {
        if (node && node.type === 'partNode') {
          const nodeIndex = partNodes.findIndex(n => n.id === node.id)
          const nodeNumber = nodeIndex + 1
          return {
            ...node,
            data: { ...node.data, number: nodeNumber }
          }
        }
        return node
      })

      return updatedNodes
    })

    // 연결된 엣지도 함께 삭제
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id))
  }, [setNodes, setEdges, setShowSettingsPanel, setSelectedNodeId])

  // =========================================================================================
  // 5. 추가 핸들러 (Add Mode 진입)
  // =========================================================================================


  // =========================================================================================
  // 3. 편집 핸들러 (Edit Mode 진입)
  // =========================================================================================

  const handleNodeEdit = useCallback((id) => {
    setEdges((eds) => {
      const targetEdge = EditorUtils.findEdge(eds, id)

      // ---------------------------------------------------------
      // Case A: Edge(그룹) 편집
      // ---------------------------------------------------------
      if (targetEdge) {
        setNodes((nds) => {
          const editableNodeIds = new Set()

          // 1. 편집 대상 노드 식별 (savedSettings 또는 Edge Source/Target)
          if (targetEdge.data?.savedSettings?.addedPartsIds && Array.isArray(targetEdge.data.savedSettings.addedPartsIds)) {
            targetEdge.data.savedSettings.addedPartsIds.forEach(nodeId => {
              const node = EditorUtils.findNode(nds, nodeId)
              if (node && node.type === 'partNode') {
                editableNodeIds.add(nodeId)
              }
            })
          } else {
            const sourceNode = EditorUtils.findNode(nds, targetEdge.source)
            const targetNode = EditorUtils.findNode(nds, targetEdge.target)

            if (sourceNode && sourceNode.type === 'partNode') editableNodeIds.add(sourceNode.id)
            if (targetNode && targetNode.type === 'partNode') editableNodeIds.add(targetNode.id)
          }

          // 2. 편집 대상 그룹 커넥터 식별
          const targetGroupId = targetEdge.data?.savedSettings?.groupId
          const targetConnectorId = targetEdge.data?.savedSettings?.connectorId
          let targetGroupConnector = null
          let finalTargetGroupId = targetGroupId

          // ID로 찾기
          if (targetConnectorId || targetGroupId) {
            targetGroupConnector = nds.find(n =>
              n && n.type === 'groupConnector' &&
              (n.id === targetConnectorId || n.data?.groupId === targetGroupId)
            )
            if (targetGroupConnector && !finalTargetGroupId) {
              finalTargetGroupId = targetGroupConnector.data?.groupId
            }
          }

          // groupEdges로 찾기 (fallback)
          if (!targetGroupConnector) {
            targetGroupConnector = nds.find(n =>
              n && n.type === 'groupConnector' &&
              n.data?.groupEdges &&
              n.data.groupEdges.includes(targetEdge.id)
            )
            if (targetGroupConnector && !finalTargetGroupId) {
              finalTargetGroupId = targetGroupConnector.data?.groupId
            }
          }

          const targetGroupEdgeIds = new Set()
          if (targetGroupConnector?.data?.groupEdges) {
            targetGroupConnector.data.groupEdges.forEach(edgeId => targetGroupEdgeIds.add(edgeId))
          } else {
            targetGroupEdgeIds.add(targetEdge.id)
          }

          // 3. 편집할 Edge 및 커넥터 ID 확정
          const editableEdges = eds.filter(edge => targetGroupEdgeIds.has(edge.id))
          const editableEdgeIds = new Set(editableEdges.map(e => e.id))
          const editableConnectorIds = new Set()

          // savedSettings 기반 커넥터 식별
          if (targetConnectorId || targetGroupId) {
            nds.forEach(node => {
              if (node && node.type === 'groupConnector') {
                if (node.id === targetConnectorId || node.data?.groupId === targetGroupId) {
                  editableConnectorIds.add(node.id)
                }
              }
            })
          }

          // groupEdges 일치 여부로 커넥터 식별 (fallback)
          if (editableConnectorIds.size === 0 && targetGroupConnector) {
            editableConnectorIds.add(targetGroupConnector.id)
          }

          if (editableConnectorIds.size === 0) {
            nds.forEach(node => {
              if (node && node.type === 'groupConnector' && node.data?.groupEdges) {
                const connectorEdgeIds = new Set(node.data.groupEdges)
                const editableEdgeIdsSet = new Set(editableEdgeIds)
                const isExactMatch =
                  connectorEdgeIds.size === editableEdgeIdsSet.size &&
                  Array.from(connectorEdgeIds).every(edgeId => editableEdgeIdsSet.has(edgeId))

                if (isExactMatch) {
                  editableConnectorIds.add(node.id)
                }
              }
            })
          }

          // 4. 하위 그룹 커넥터 식별 및 [추가] 하위 그룹 엣지 수집 (잠금 해제용)
          const childGroupConnectorIds = new Set()
          const childGroupEdgeIds = new Set() // [추가] 하위 그룹의 엣지 ID들을 담을 Set

          if (targetEdge.data?.savedSettings?.addedPartsIds && Array.isArray(targetEdge.data.savedSettings.addedPartsIds)) {
            targetEdge.data.savedSettings.addedPartsIds.forEach(nodeId => {
              const node = EditorUtils.findNode(nds, nodeId)
              if (node && node.type === 'groupConnector') {
                childGroupConnectorIds.add(nodeId)
                // [추가] 하위 그룹 커넥터가 가진 엣지들도 수집
                if (node.data?.groupEdges) {
                  node.data.groupEdges.forEach(eid => childGroupEdgeIds.add(eid))
                }
              }
            })
          }

          // 5. 노드 상태 업데이트 (편집 모드로 전환)
          const updatedNodes = nds.map(node => {
            // 파츠 노드: 편집 모드
            if (editableNodeIds.has(node.id)) {
              return {
                ...node,
                draggable: true,
                data: {
                  ...node.data,
                  isConfirmed: false,
                  // [수정] 편집 모드로 돌아오면 잠금 해제 (단, parentId는 유지하여 그룹 소속임은 표시)
                  isLockedByParent: false
                }
              }
            }
            // 그룹 커넥터 처리
            if (node.type === 'groupConnector') {
              // 하위 그룹 커넥터는 다시 보이게 설정
              if (childGroupConnectorIds.has(node.id)) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    hidden: false,
                    isConfirmed: node.data?.isConfirmed || false,
                    isLockedByParent: false // [수정] 하위 그룹 커넥터 잠금 해제
                  }
                }
              }

              // 현재 편집 중인 그룹 커넥터는 숨김 (라벨 박스를 보여주기 위함)
              if (editableConnectorIds.has(node.id) && typeof node.data?.isLastNode === 'undefined') {
                return {
                  ...node,
                  data: { ...node.data, hidden: true, isConfirmed: node.data?.isConfirmed || false }
                }
              }
              // 그 외 확정된 커넥터는 유지
              if (node.data?.isConfirmed === true && !editableConnectorIds.has(node.id)) {
                return { ...node, data: { ...node.data } }
              }
            }
            return node
          }).filter(Boolean)

          setIsEdgeConfirmed(false)

          // 6. 설정 패널 데이터 로드
          const editedEdge = EditorUtils.findEdge(eds, id)
          if (editedEdge && editedEdge.data?.savedSettings) {
            const { addedPartsIds, ...settingsData } = editedEdge.data.savedSettings
            setSettingsData(settingsData)

            if (addedPartsIds && Array.isArray(addedPartsIds) && addedPartsIds.length > 0) {
              const savedAddedParts = updatedNodes.filter(n =>
                n && addedPartsIds.includes(n.id) && (n.type === 'partNode' || n.type === 'groupConnector')
              )
              setAddedParts(savedAddedParts)
            } else {
              // addedPartsIds가 없는 경우 Source/Target으로 설정
              const addedParts = []
              const sourceNode = updatedNodes.find(n => n && n.id === editedEdge.source)
              const targetNode = updatedNodes.find(n => n && n.id === editedEdge.target)

              if (sourceNode && (sourceNode.type === 'partNode' || sourceNode.type === 'groupConnector')) {
                addedParts.push(sourceNode)
              }
              if (targetNode && (targetNode.type === 'partNode' || targetNode.type === 'groupConnector')) {
                if (!addedParts.some(p => p.id === targetNode.id)) {
                  addedParts.push(targetNode)
                }
              }
              setAddedParts(addedParts)
            }

            setSelectedNodeId(id)
            setShowSettingsPanel(true)
          }

          // 7. Edge 상태 업데이트 (isConfirmed: false)
          setTimeout(() => {
            setEdges((currentEdges) => {
              return currentEdges.map(edge => {
                if (targetEdge.id === edge.id) {
                  return {
                    ...edge,
                    data: {
                      ...edge.data,
                      isConfirmed: false,
                      savedSettings: edge.data?.savedSettings
                    }
                  }
                }
                // [추가] 하위 그룹에 속한 엣지들도 잠금 해제
                if (childGroupEdgeIds.has(edge.id)) {
                  return {
                    ...edge,
                    data: { ...edge.data, isLockedByParent: false }
                  }
                }
                return edge
              })
            })
          }, 0)

          return updatedNodes
        })

        return eds
      }

      // ---------------------------------------------------------
      // Case B: 단일 노드 편집
      // ---------------------------------------------------------
      setNodes((nds) => {
        const startNode = EditorUtils.findNode(nds, id)
        if (!startNode || startNode.type !== 'partNode') {
          return nds
        }

        const updatedNodes = nds.map(node => {
          // 해당 노드 편집 모드
          if (node.id === id) {
            return {
              ...node,
              draggable: true,
              data: { ...node.data, isConfirmed: false }
            }
          }
          // 해당 노드의 단일 커넥터 숨김
          if (node.type === 'groupConnector' && node.data?.nodeId === id) {
            return {
              ...node,
              data: { ...node.data, hidden: true, isConfirmed: node.data?.isConfirmed || false }
            }
          }
          return node
        })

        // Edge 라벨 및 커넥터 업데이트 트리거
        setTimeout(() => {
          setEdges((currentEdges) => {
            setNodes((currentNodes) => {
              if (!currentNodes || !Array.isArray(currentNodes)) {
                return currentNodes || []
              }

              const singleNodeGroupId = EditorUtils.createSingleNodeGroupId(id)

              const { updatedEdges, groupConnectorNodes } = updateEdgeLabelsCallback(
                currentEdges,
                currentNodes,
                rfInstance,
                handleEdgeDelete,
                handleNodeSettingsClick,
                handleNodeConfirmRef.current,
                null,
                singleNodeGroupId
              )

              // 단일 노드 커넥터 숨김 처리 (편집 중이므로)
              const connectorId = EditorUtils.createSingleNodeConnectorId(id)
              const existingConnector = EditorUtils.findConnector(currentNodes, connectorId)

              if (existingConnector) {
                const updatedNodes = currentNodes.map(node => {
                  if (node.id === connectorId) {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        hidden: true,
                        isConfirmed: node.data?.isConfirmed || false
                      }
                    }
                  }
                  return node
                })
                return updatedNodes
              }

              return currentNodes
            })
            return currentEdges
          })
        }, 0)

        return updatedNodes
      })
      return eds
    })
  }, [setNodes, setEdges, setIsEdgeConfirmed, setShowSettingsPanel, setSelectedNodeId, setAddedParts, setSettingsData, rfInstance, handleEdgeDelete, handleNodeSettingsClick, updateEdgeLabelsCallback])

  // handleNodeEdit를 ref에 저장 (순환 참조 방지)
  handleNodeEditRef.current = handleNodeEdit


  // =========================================================================================
  // 4. 확정 핸들러 (Confirm)
  // =========================================================================================

  const handleNodeConfirm = useCallback((id) => {
    if (confirmingRef.current.has(id)) {
      return
    }
    confirmingRef.current.add(id)

    // 1. 설정값 유효성 검사
    const currentSettings = settingsDataRef.current
    if (!currentSettings.step) {
      confirmingRef.current.delete(id)
      showSmallAlert({ icon: 'warning', title: 'Required', text: 'Please select a order' })
      setShowSettingsPanel(true)
      return setFocusField('step')
    }
    if (!currentSettings.process) {
      confirmingRef.current.delete(id)
      showSmallAlert({ icon: 'warning', title: 'Required', text: 'Please select a process' })
      setShowSettingsPanel(true)
      return setFocusField('process')
    }
    setFocusField(null)

    setEdges((eds) => {
      const targetEdge = EditorUtils.findEdge(eds, id)

      // ---------------------------------------------------------
      // Case A: Edge(그룹) 확정
      // ---------------------------------------------------------
      if (targetEdge) {
        if (!targetEdge.data?.stepValue) {
          confirmingRef.current.delete(id)
          setTimeout(() => {
            showSmallAlert({ icon: 'warning', title: 'Required', text: 'Please enter a step value' })
            const stepInput = document.querySelector(`.edge-label-box[data-edge-id="${id}"] .node-step-input`)
            if (stepInput) {
              stepInput.focus()
              stepInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 0)
          return eds
        }

        // 데이터 준비
        const currentAddedParts = addedPartsRef.current
        const savedAddedPartsIds = targetEdge.data?.savedSettings?.addedPartsIds
        const addedPartsIds = savedAddedPartsIds && Array.isArray(savedAddedPartsIds) && savedAddedPartsIds.length > 0
          ? savedAddedPartsIds
          : currentAddedParts.map(part => typeof part === 'string' ? part : part.id).filter(Boolean)

        const tempNodeIds = new Set([targetEdge.source, targetEdge.target])
        const tempGroupId = EditorUtils.createGroupId(tempNodeIds)
        const tempConnectorId = EditorUtils.createGroupConnectorId(tempGroupId)

        // Edge 상태 업데이트 (확정)
        const updatedEdges = eds.map(edge => {
          if (edge.id === id) {
            return {
              ...edge,
              data: {
                ...edge.data,
                isConfirmed: true,
                showLabel: true,
                savedSettings: {
                  ...currentSettings,
                  addedPartsIds: addedPartsIds,
                  groupId: tempGroupId,
                  connectorId: tempConnectorId
                }
              }
            }
          }
          return edge
        })

        setIsEdgeConfirmed(true)

        setNodes((nds) => {
          // 관련 노드 식별
          const allPartNodeIds = new Set()
          const groupConnectorIds = new Set()

          addedPartsIds.forEach(nodeId => {
            const node = EditorUtils.findNode(nds, nodeId)
            if (node && node.type === 'groupConnector' && node.data?.isGroupBox === true) {
              groupConnectorIds.add(nodeId)
              if (node.data?.nodeIds && Array.isArray(node.data.nodeIds)) {
                node.data.nodeIds.forEach(id => {
                  const partNode = EditorUtils.findNode(nds, id)
                  if (partNode && partNode.type === 'partNode') {
                    allPartNodeIds.add(id)
                  }
                })
              }
              if (node.data?.nodeId) {
                const partNode = EditorUtils.findNode(nds, node.data.nodeId)
                if (partNode && partNode.type === 'partNode') {
                  allPartNodeIds.add(node.data.nodeId)
                }
              }
            } else if (node && node.type === 'partNode') {
              allPartNodeIds.add(nodeId)
            }
          })

          const allConnectedNodeIds = new Set(Array.from(allPartNodeIds))

          // 숨김 처리할 하위 커넥터 식별 (단일 노드 커넥터 포함)
          const partsToCheckForHiding = [...addedPartsIds];

          nds.forEach(node => {
            if (node.type === 'groupConnector' && node.data?.nodeId) {
              if (allConnectedNodeIds.has(node.data.nodeId)) {
                if (!partsToCheckForHiding.includes(node.id)) {
                  partsToCheckForHiding.push(node.id);
                }
              }
            }
          });

          if (allConnectedNodeIds.size === 0) {
            confirmingRef.current.delete(id)
            return nds
          }

          const connectedEdges = eds.filter(edge => {
            if (edge.id === id) return true
            if (allConnectedNodeIds.has(edge.source) || allConnectedNodeIds.has(edge.target)) return true
            if (groupConnectorIds.size > 0) {
              for (const connectorId of groupConnectorIds) {
                const connector = EditorUtils.findNode(nds, connectorId)
                if (connector && connector.data?.groupEdges && Array.isArray(connector.data.groupEdges)) {
                  if (connector.data.groupEdges.includes(edge.id)) return true
                }
              }
            }
            return false
          })

          const savedGroupId = targetEdge.data?.savedSettings?.groupId
          const savedConnectorId = targetEdge.data?.savedSettings?.connectorId

          const groupId = savedGroupId || EditorUtils.createGroupId(allConnectedNodeIds)
          const connectorId = savedConnectorId || EditorUtils.createGroupConnectorId(groupId)

          // 2. Edge 라벨 및 그룹 커넥터 업데이트
          const { updatedEdges: finalEdges, groupConnectorNodes } = updateEdgeLabelsCallback(updatedEdges, nds, rfInstance, handleEdgeDelete, handleNodeSettingsClick, handleNodeConfirmRef.current, null, groupId)

          setEdges(finalEdges)

          // 3. 파츠 노드 확정 상태로 업데이트
          const updatedPartNodes = nds.map(node => {
            if (allConnectedNodeIds.has(node.id) && node.type === 'partNode') {
              return {
                ...node,
                draggable: false,
                data: {
                  ...node.data,
                  isConfirmed: true,
                  savedSettings: { ...currentSettings },
                  onEdit: node.data?.onEdit || (() => handleNodeEdit(node.id)),
                  onSettingsClick: node.data?.onSettingsClick,
                  onDelete: node.data?.onDelete,
                  onStepChange: node.data?.onStepChange,
                  onConfirm: node.data?.onConfirm,
                  onTextChange: node.data?.onTextChange
                }
              }
            }
            return node
          })

          const filteredNodes = updatedPartNodes.filter(n => n && n.type !== 'groupConnector')
          const existingConnectorMap = new Map(
            nds.filter(n => n && n.type === 'groupConnector').map(n => [n.id, n])
          )

          const updatedConnectorMap = new Map()

          // 4. 그룹 커넥터 생성 및 업데이트
          if (groupConnectorNodes && Array.isArray(groupConnectorNodes)) {
            groupConnectorNodes.forEach(newConnector => {
              const shouldMatch = isMatchingConnector(newConnector, groupId, connectorId, connectedEdges)

              if (shouldMatch) {
                // DOM 렌더링 후 커넥터 위치 계산
                calculateConnectorPositionCallback(connectedEdges, nds, rfInstance).then(connectorPosition => {
                  if (connectorPosition) {
                    setNodes((currentNodes) => {
                      return currentNodes.map(node => {
                        if (node.id === newConnector.id) {
                          return { ...node, position: connectorPosition }
                        }
                        return node
                      })
                    })
                  }
                })

                const updatedConnectorData = {
                  ...newConnector,
                  position: newConnector.position,
                  data: {
                    ...newConnector.data,
                    isConfirmed: true,
                    isGroupBox: true,
                    groupId: groupId,
                    groupEdges: connectedEdges.map(e => e.id),
                    nodeIds: Array.from(allConnectedNodeIds),
                    savedSettings: { ...currentSettings, addedPartsIds: addedPartsIds },
                    hidden: false,
                    isGroupToGroup: false
                  }
                }
                updatedConnectorMap.set(newConnector.id, updatedConnectorData)
              } else {
                const connectorToAdd = newConnector.data?.isConfirmed === true
                  ? { ...newConnector, data: { ...newConnector.data, isGroupToGroup: false } }
                  : newConnector
                updatedConnectorMap.set(newConnector.id, connectorToAdd)
              }
            })
          }

          // 5. 기존 그룹 커넥터가 맵에 없으면 추가 (재활용)
          const existingGroupConnector = findGroupConnector(connectorId, groupId, connectedEdges, nds)

          if (existingGroupConnector && !updatedConnectorMap.has(existingGroupConnector.id)) {
            const groupPartNodesForExisting = nds.filter(n =>
              n && allConnectedNodeIds.has(n.id) && n.type === 'partNode'
            )
            const addedPartsIdsForExisting = groupPartNodesForExisting.map(n => n.id)

            calculateConnectorPositionCallback(connectedEdges, nds, rfInstance).then(newConnectorPosition => {
              if (newConnectorPosition) {
                setNodes((currentNodes) => {
                  return currentNodes.map(node => {
                    if (node.id === existingGroupConnector.id) {
                      return { ...node, position: newConnectorPosition }
                    }
                    return node
                  })
                })
              }
            })

            const updatedConnector = {
              ...existingGroupConnector,
              position: existingGroupConnector.position,
              data: {
                ...existingGroupConnector.data,
                isConfirmed: true,
                isGroupBox: true,
                groupId: groupId,
                groupEdges: connectedEdges.map(e => e.id),
                nodeIds: Array.from(allConnectedNodeIds),
                savedSettings: { ...currentSettings, addedPartsIds: addedPartsIdsForExisting, groupId: groupId, connectorId: existingGroupConnector.id },
                hidden: false,
                isGroupToGroup: false
              }
            }

            updatedConnectorMap.set(existingGroupConnector.id, updatedConnector)
          } else if (!existingGroupConnector && !updatedConnectorMap.has(connectorId)) {
            // 6. 새로운 커넥터 생성 (Fallback)
            let position = null

            calculateConnectorPositionCallback(connectedEdges, nds, rfInstance).then(calculatedPosition => {
              if (calculatedPosition) {
                setNodes((currentNodes) => {
                  return currentNodes.map(node => {
                    if (node.id === connectorId) {
                      return { ...node, position: calculatedPosition }
                    }
                    return node
                  })
                })
              }
            })

            if (!position) {
              const groupPartNodes = nds.filter(n => n && allConnectedNodeIds.has(n.id) && n.type === 'partNode')
              const firstNode = groupPartNodes[0]
              const labelX = firstNode ? firstNode.position.x + 90 : 0
              const labelY = firstNode ? firstNode.position.y + 200 + 60 : 0
              position = { x: labelX, y: labelY }
            }

            const groupPartNodes = nds.filter(n => n && allConnectedNodeIds.has(n.id) && n.type === 'partNode')
            const addedPartsIdsForNew = groupPartNodes.map(n => n.id)

            const newConnector = {
              id: connectorId,
              type: 'groupConnector',
              position: position,
              data: {
                isConfirmed: true,
                isGroupBox: true,
                groupId: groupId,
                groupEdges: connectedEdges.map(e => e.id),
                nodeIds: Array.from(allConnectedNodeIds),
                savedSettings: { ...currentSettings, addedPartsIds: addedPartsIdsForNew, groupId: groupId, connectorId: connectorId },
                hidden: false,
                isGroupToGroup: false
              },
              zIndex: 1001
            }

            updatedConnectorMap.set(connectorId, newConnector)
          }

          // 7. 하위 그룹 커넥터 숨김 처리 식별
          const childGroupConnectorIds = hideChildGroupConnectors(partsToCheckForHiding, nds, existingConnectorMap, groupConnectorNodes, updatedConnectorMap)

          // 8. 마지막 노드(End Node) 찾기 (숨김 예외 대상)
          const groupSourceNodeIds = new Set(connectedEdges.map(e => e.source));
          const lastPartNodeId = Array.from(allConnectedNodeIds).find(id => !groupSourceNodeIds.has(id));

          let lastNodeConnectorId = null;
          if (lastPartNodeId) {
            const lastConnector = nds.findLast(n =>
              n.type === 'groupConnector' &&
              typeof n.data?.isLastNode === "undefined" &&
              n.data?.isGroupBox === true
            );
            if (lastConnector) lastNodeConnectorId = lastConnector.id;
          }

          const allIdsToHide = new Set([...childGroupConnectorIds]);
          partsToCheckForHiding.forEach(id => allIdsToHide.add(id));

          // 9. 기존 커넥터 유지 및 병합
          existingConnectorMap.forEach((existingConnector, connectorId) => {
            if (!updatedConnectorMap.has(connectorId)) {
              if ((existingConnector.data?.isConfirmed === true || existingConnector.data?.isGroupBox === true) && typeof existingConnector.data?.isLastNode === "undefined" && !existingConnector.data?.hidden) {
                updatedConnectorMap.set(connectorId, existingConnector);
              }
            }
          });

          // 10. [핵심] 강제 숨김 처리 (Overwrite)
          allIdsToHide.forEach(idToHide => {
            if (idToHide === lastNodeConnectorId) return;

            if (updatedConnectorMap.has(idToHide)) {
              const targetConnector = updatedConnectorMap.get(idToHide);
              updatedConnectorMap.set(idToHide, {
                ...targetConnector,
                data: {
                  ...targetConnector.data,
                  hidden: true // 강제 숨김
                }
              });
            }
          });

          const finalConnectors = Array.from(updatedConnectorMap.values())

          confirmingRef.current.delete(id)

          setTimeout(() => {
            setShowSettingsPanel(false)
            setSelectedNodeId(null)
          }, 0)

          return [...filteredNodes, ...finalConnectors]
        })

        return updatedEdges
      }

      // ---------------------------------------------------------
      // Case B: 단일 노드 확정
      // ---------------------------------------------------------
      setNodes((nds) => {
        const startNode = EditorUtils.findNode(nds, id)
        if (!startNode || startNode.type !== 'partNode') {
          confirmingRef.current.delete(id)
          return nds
        }

        if (!startNode.data?.stepValue) {
          confirmingRef.current.delete(id)
          setTimeout(() => {
            showSmallAlert({ icon: 'warning', title: 'Required', text: 'Please enter a step value' })
            const stepInput = document.querySelector(`.node-label-box[data-node-id="${id}"] .node-step-input`)
            if (stepInput) {
              stepInput.focus()
              stepInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 0)
          return nds
        }

        if (startNode.data?.isTextNode) {
          if (!startNode.data?.text || startNode.data.text.trim() === '') {
            confirmingRef.current.delete(id)
            setTimeout(() => {
              showSmallAlert({ icon: 'warning', title: 'Required', text: 'Please enter text in the text node' })
              const textInput = document.querySelector(`.node-text-input[data-node-id="${id}"], .custom-node-wrapper[data-text-node="true"] .node-text-input`)
              if (textInput) {
                textInput.focus()
                textInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            }, 0)
            return nds
          }
        }

        const updatedNodes = nds.map(node => {
          if (node.id === id) {
            return {
              ...node,
              draggable: false,
              data: {
                ...node.data,
                isConfirmed: true,
                savedSettings: { ...currentSettings },
                onEdit: node.data?.onEdit || (() => handleNodeEdit(node.id)),
                onSettingsClick: node.data?.onSettingsClick,
                onDelete: node.data?.onDelete,
                onStepChange: node.data?.onStepChange,
                onConfirm: node.data?.onConfirm,
                onTextChange: node.data?.onTextChange,
              }
            }
          }
          return node
        })

        const confirmedNode = updatedNodes.find(n => n.id === id)
        if (confirmedNode) {
          confirmingRef.current.delete(id)
          setTimeout(() => {
            setShowSettingsPanel(false)
            setSelectedNodeId(null)
          }, 0)
        } else {
          confirmingRef.current.delete(id)
        }
        return updatedNodes
      })

      return eds
    })

    // 단일 노드 커넥터 업데이트 및 최종 정리 로직
    setTimeout(() => {
      setEdges((currentEdges) => {
        setNodes((currentNodes) => {
          if (!currentNodes || !Array.isArray(currentNodes)) {
            return currentNodes || []
          }

          const singleNode = EditorUtils.findNode(currentNodes, id)
          const isSingleNode = singleNode && singleNode.type === 'partNode' && singleNode.data?.isConfirmed === true
          const hasEdge = currentEdges.some(e => e.source === id || e.target === id)
          const singleNodeGroupId = isSingleNode && !hasEdge ? EditorUtils.createSingleNodeGroupId(id) : null

          const { updatedEdges, groupConnectorNodes } = updateEdgeLabelsCallback(
            currentEdges,
            currentNodes,
            rfInstance,
            handleEdgeDelete,
            handleNodeSettingsClick,
            handleNodeConfirmRef.current,
            null,
            singleNodeGroupId
          )

          const filteredNodes = EditorUtils.filterPartNodes(currentNodes)
          const existingConnectorMap = EditorUtils.createConnectorMap(currentNodes)
          const updatedConnectorMap = EditorUtils.createUpdatedConnectorMap(
            groupConnectorNodes,
            existingConnectorMap,
            currentNodes
          )

          const finalConnectors = Array.from(updatedConnectorMap.values())

          setTimeout(() => setEdges(updatedEdges), 0)
          return [...filteredNodes, ...finalConnectors]
        })
        return currentEdges
      })
    }, 100)
  }, [rfInstance, setNodes, setEdges, handleEdgeDelete, handleNodeSettingsClick, setShowSettingsPanel, setFocusField, settingsDataRef, setAddedParts, calculateConnectorPositionCallback, addedPartsRef, confirmingRef, setIsEdgeConfirmed, updateEdgeLabelsCallback, handleNodeEdit])

  // handleNodeConfirm를 ref에 저장
  handleNodeConfirmRef.current = handleNodeConfirm

  // =========================================================================================
  // 4. 드래그 핸들러 (그룹 이동 지원)
  // =========================================================================================

  const onNodeDragStart = useCallback((event, node) => {
    if (node.type === 'partNode' && node.data?.isConfirmed === true) {
      draggingGroupRef.current = null
      return
    }

    if (node.type === 'groupConnector' && node.data?.isGroupBox === true) {
      const groupNodeIds = node.data?.nodeIds || []
      const groupId = node.data?.groupId
      const isConfirmed = node.data?.isConfirmed === true

      const groupNodeIdSet = new Set()

      if (isConfirmed && groupNodeIds.length > 0) {
        groupNodeIds.forEach(id => {
          const targetNode = nodes.find(n => n && n.id === id)
          if (targetNode && targetNode.type === 'partNode') {
            groupNodeIdSet.add(id)
          }
        })
      } else {
        groupNodeIds.forEach(id => {
          const targetNode = nodes.find(n => n && n.id === id)
          if (targetNode && targetNode.type === 'partNode') {
            groupNodeIdSet.add(id)
          }
        })

        if (node.data?.groupEdges && Array.isArray(node.data.groupEdges)) {
          node.data.groupEdges.forEach(edgeId => {
            const edge = edges.find(e => e && e.id === edgeId)
            if (edge) {
              if (edge.source && edge.source !== node.id) {
                const sourceNode = nodes.find(n => n && n.id === edge.source)
                if (sourceNode && sourceNode.type === 'partNode') {
                  groupNodeIdSet.add(edge.source)
                }
              }
              if (edge.target && edge.target !== node.id) {
                const targetNode = nodes.find(n => n && n.id === edge.target)
                if (targetNode && targetNode.type === 'partNode') {
                  groupNodeIdSet.add(edge.target)
                }
              }
            }
          })
        }
      }

      draggingGroupRef.current = {
        connectorId: node.id,
        groupId: groupId,
        groupNodeIds: Array.from(groupNodeIdSet),
        startPosition: { ...node.position }
      }
    } else {
      draggingGroupRef.current = null
    }
  }, [edges, nodes])

  const onNodeDrag = useCallback((event, node) => {
    if (node.type === 'partNode' && node.data?.isConfirmed === true) {
      return
    }

    if (draggingGroupRef.current && draggingGroupRef.current.connectorId === node.id) {
      const { groupNodeIds, startPosition } = draggingGroupRef.current

      const deltaX = node.position.x - startPosition.x
      const deltaY = node.position.y - startPosition.y

      if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
        setNodes((currentNodes) => {
          const updatedNodes = currentNodes.map(n => {
            if (n.id === node.id) return n

            if (n.type === 'partNode' && n.data?.isConfirmed === true) return n

            const isInGroup = groupNodeIds.includes(n.id)

            if (isInGroup) {
              return {
                ...n,
                position: {
                  x: n.position.x + deltaX,
                  y: n.position.y + deltaY
                }
              }
            }

            return n
          })

          draggingGroupRef.current.startPosition = { ...node.position }

          return updatedNodes
        })
      }
    }
  }, [setNodes])

  const onNodeDragStop = useCallback((event, node) => {
    if (draggingGroupRef.current && draggingGroupRef.current.connectorId === node.id) {
      draggingGroupRef.current = null
    }
  }, [])

  return {
    handleNodeStepChange,
    handleNodeDelete,
    handleNodeEdit,
    handleNodeConfirm,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop
  }
}