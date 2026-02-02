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
  // handleNodeEdit 참조 (순환 참조 방지)
  const handleNodeEditRef = useRef(null)
  // handleNodeConfirm 참조 (순환 참조 방지)
  const handleNodeConfirmRef = useRef(null)
  // 노드 Step Value 변경 핸들러
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

  // 노드 삭제 핸들러
  const handleNodeDelete = useCallback((id) => {
    // 삭제되는 노드가 현재 설정패널에 열려있는지 확인
    setSelectedNodeId((currentSelectedId) => {
      if (currentSelectedId === id) {
        // 설정패널 닫기
        setShowSettingsPanel(false)
        return null
      }
      return currentSelectedId
    })

    setNodes((nds) => {
      // 삭제되는 노드가 groupConnector인지 확인
      const nodeToDelete = EditorUtils.findNode(nds, id)
      if (nodeToDelete && nodeToDelete.type === 'groupConnector') {
        // groupConnector 삭제 시 관련 edge들도 확인
        setEdges((eds) => {
          const relatedEdges = eds.filter(edge => {
            // edge의 savedSettings에 connectorId가 있고, 삭제되는 connector와 일치하는지 확인
            if (edge.data?.savedSettings?.connectorId === id) {
              return true
            }
            // edge의 groupEdges에 포함된 edge들 중 삭제되는 connector와 관련이 있는지 확인
            return false
          })
          
          // 관련 edge 중 현재 선택된 edge가 있는지 확인
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

      // 노드 삭제
      const filteredNodes = nds.filter((node) => node.id !== id)

      // 파츠 노드만 필터링 (groupConnector 제외)
      const partNodes = filteredNodes.filter(n => n && n.type === 'partNode')

      // 파츠 노드 번호 재정렬
      const updatedNodes = filteredNodes.map(node => {
        if (node && node.type === 'partNode') {
          const nodeIndex = partNodes.findIndex(n => n.id === node.id)
          const nodeNumber = nodeIndex + 1
          return {
            ...node,
            data: {
              ...node.data,
              number: nodeNumber
            }
          }
        }
        return node
      })

      return updatedNodes
    })
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id))
  }, [setNodes, setEdges, setShowSettingsPanel, setSelectedNodeId])

  // 노드 편집 핸들러
  const handleNodeEdit = useCallback((id) => {
    setEdges((eds) => {
      const targetEdge = EditorUtils.findEdge(eds, id)

      if (targetEdge) {
        setNodes((nds) => {
          const editableNodeIds = new Set()

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

            if (sourceNode && sourceNode.type === 'partNode') {
              editableNodeIds.add(sourceNode.id)
            }
            if (targetNode && targetNode.type === 'partNode') {
              editableNodeIds.add(targetNode.id)
            }
          }

          const targetGroupId = targetEdge.data?.savedSettings?.groupId
          const targetConnectorId = targetEdge.data?.savedSettings?.connectorId

          // targetGroupConnector 찾기 (savedSettings가 있으면 사용, 없으면 groupEdges로 찾기)
          let targetGroupConnector = null
          let finalTargetGroupId = targetGroupId
          
          if (targetConnectorId || targetGroupId) {
            targetGroupConnector = nds.find(n =>
              n && n.type === 'groupConnector' &&
              (n.id === targetConnectorId || n.data?.groupId === targetGroupId)
            )
            if (targetGroupConnector && !finalTargetGroupId) {
              finalTargetGroupId = targetGroupConnector.data?.groupId
            }
          }

          // savedSettings가 없으면 groupEdges로 커넥터 찾기
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
            targetGroupConnector.data.groupEdges.forEach(edgeId => {
              targetGroupEdgeIds.add(edgeId)
            })
          } else {
            targetGroupEdgeIds.add(targetEdge.id)
          }

          const editableEdges = eds.filter(edge => {
            if (targetGroupEdgeIds.has(edge.id)) {
              return true
            }
            return false
          })

          const editableEdgeIds = new Set(editableEdges.map(e => e.id))

          const editableConnectorIds = new Set()

          // savedSettings에서 connectorId나 groupId가 있으면 사용
          if (targetConnectorId || targetGroupId) {
            nds.forEach(node => {
              if (node && node.type === 'groupConnector') {
                if (node.id === targetConnectorId || node.data?.groupId === targetGroupId) {
                  editableConnectorIds.add(node.id)
                }
              }
            })
          }

          // savedSettings가 없거나 찾지 못한 경우, groupEdges로 정확히 일치하는 커넥터 찾기
          if (editableConnectorIds.size === 0 && targetGroupConnector) {
            editableConnectorIds.add(targetGroupConnector.id)
          }

          // 여전히 찾지 못한 경우, 모든 커넥터를 검사하여 groupEdges가 정확히 일치하는 것 찾기
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

          const childGroupConnectorIds = new Set()
          if (targetEdge.data?.savedSettings?.addedPartsIds && Array.isArray(targetEdge.data.savedSettings.addedPartsIds)) {
            targetEdge.data.savedSettings.addedPartsIds.forEach(nodeId => {
              const node = EditorUtils.findNode(nds, nodeId)
              if (node && node.type === 'groupConnector') {
                childGroupConnectorIds.add(nodeId)
              }
            })
          }

          const updatedNodes = nds.map(node => {
            if (editableNodeIds.has(node.id)) {
              return {
                ...node,
                draggable: true,
                data: {
                  ...node.data,
                  isConfirmed: false
                }
              }
            }
            if (node.type === 'groupConnector') {
              if (childGroupConnectorIds.has(node.id)) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    hidden: false,
                    isConfirmed: node.data?.isConfirmed || false
                  }
                }
              }

              // editableConnectorIds에 포함된 커넥터만 편집 모드로 전환 (다른 그룹 커넥터는 영향받지 않음)
              if (editableConnectorIds.has(node.id) && typeof node.data?.isLastNode === 'undefined') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    hidden: true,
                    isConfirmed: node.data?.isConfirmed || false
                  }
                }
              }
              // editableConnectorIds에 포함되지 않은 확정된 커넥터는 그대로 유지 (편집 모드로 전환하지 않음)
              if (node.data?.isConfirmed === true && !editableConnectorIds.has(node.id)) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                  }
                }
              }
            }
            return node
          }).filter(Boolean)

          setIsEdgeConfirmed(false)

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
                return edge
              })
            })
          }, 0)

          return updatedNodes
        })

        return eds
      }

      setNodes((nds) => {
        const startNode = EditorUtils.findNode(nds, id)
        if (!startNode || startNode.type !== 'partNode') {
          return nds
        }

        const updatedNodes = nds.map(node => {
          if (node.id === id) {
            return {
              ...node,
              draggable: true,
              data: {
                ...node.data,
                isConfirmed: false
              }
            }
          }
          if (node.type === 'groupConnector' && node.data?.nodeId === id) {
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

  // handleNodeEdit를 ref에 저장
  handleNodeEditRef.current = handleNodeEdit

  // 노드 확정 핸들러
  const handleNodeConfirm = useCallback((id) => {
    if (confirmingRef.current.has(id)) {
      return
    }
    confirmingRef.current.add(id)

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

        const currentAddedParts = addedPartsRef.current
        const savedAddedPartsIds = targetEdge.data?.savedSettings?.addedPartsIds
        const addedPartsIds = savedAddedPartsIds && Array.isArray(savedAddedPartsIds) && savedAddedPartsIds.length > 0
          ? savedAddedPartsIds
          : currentAddedParts.map(part => typeof part === 'string' ? part : part.id).filter(Boolean)

        const tempNodeIds = new Set([targetEdge.source, targetEdge.target])
        const tempGroupId = EditorUtils.createGroupId(tempNodeIds)
        const tempConnectorId = EditorUtils.createGroupConnectorId(tempGroupId)

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

          if (allConnectedNodeIds.size === 0) {
            confirmingRef.current.delete(id)
            return nds
          }

          const connectedEdges = eds.filter(edge => {
            if (edge.id === id) return true
            
            if (allConnectedNodeIds.has(edge.source) || allConnectedNodeIds.has(edge.target)) {
              return true
            }
            
            if (groupConnectorIds.size > 0) {
              for (const connectorId of groupConnectorIds) {
                const connector = EditorUtils.findNode(nds, connectorId)
                if (connector && connector.data?.groupEdges && Array.isArray(connector.data.groupEdges)) {
                  if (connector.data.groupEdges.includes(edge.id)) {
                    return true
                  }
                }
              }
            }
            
            return false
          })

          const savedGroupId = targetEdge.data?.savedSettings?.groupId
          const savedConnectorId = targetEdge.data?.savedSettings?.connectorId

          const groupId = savedGroupId || EditorUtils.createGroupId(allConnectedNodeIds)
          const connectorId = savedConnectorId || EditorUtils.createGroupConnectorId(groupId)

          const { updatedEdges: finalEdges, groupConnectorNodes } = updateEdgeLabelsCallback(updatedEdges, nds, rfInstance, handleEdgeDelete, handleNodeSettingsClick, handleNodeConfirmRef.current, null, groupId)

          setEdges(finalEdges)

          const updatedPartNodes = nds.map(node => {
            if (allConnectedNodeIds.has(node.id) && node.type === 'partNode') {
              return {
                ...node,
                draggable: true,
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
            nds
              .filter(n => n && n.type === 'groupConnector')
              .map(n => [n.id, n])
          )

          const updatedConnectorMap = new Map()

          if (groupConnectorNodes && Array.isArray(groupConnectorNodes)) {
            groupConnectorNodes.forEach(newConnector => {
              const shouldMatch = isMatchingConnector(newConnector, groupId, connectorId, connectedEdges)

              if (shouldMatch) {
                // DOM 렌더링 완료 후 커넥터 위치 계산
                calculateConnectorPositionCallback(connectedEdges, nds, rfInstance).then(connectorPosition => {
                  if (connectorPosition) {
                    setNodes((currentNodes) => {
                      return currentNodes.map(node => {
                        if (node.id === newConnector.id) {
                          return {
                            ...node,
                            position: connectorPosition
                          }
                        }
                        return node
                      })
                    })
                  }
                })

                const updatedConnectorData = {
                  ...newConnector,
                  position: newConnector.position, // 초기 위치, DOM 렌더링 후 업데이트됨
                  data: {
                    ...newConnector.data,
                    isConfirmed: true,
                    isGroupBox: true,
                    groupId: groupId,
                    groupEdges: connectedEdges.map(e => e.id),
                    nodeIds: Array.from(allConnectedNodeIds),
                    savedSettings: {
                      ...currentSettings,
                      addedPartsIds: addedPartsIds
                    },
                    hidden: false,
                    isGroupToGroup: false
                  }
                }

                updatedConnectorMap.set(newConnector.id, updatedConnectorData)
              } else {
                const connectorToAdd = newConnector.data?.isConfirmed === true
                  ? {
                    ...newConnector,
                    data: {
                      ...newConnector.data,
                      isGroupToGroup: false
                    }
                  }
                  : newConnector
                updatedConnectorMap.set(newConnector.id, connectorToAdd)
              }
            })
          }

          const existingGroupConnector = findGroupConnector(connectorId, groupId, connectedEdges, nds)

          if (existingGroupConnector && !updatedConnectorMap.has(existingGroupConnector.id)) {
            const groupPartNodesForExisting = nds.filter(n =>
              n && allConnectedNodeIds.has(n.id) && n.type === 'partNode'
            )
            const addedPartsIdsForExisting = groupPartNodesForExisting.map(n => n.id)

            // DOM 렌더링 완료 후 커넥터 위치 계산
            calculateConnectorPositionCallback(connectedEdges, nds, rfInstance).then(newConnectorPosition => {
              if (newConnectorPosition) {
                setNodes((currentNodes) => {
                  return currentNodes.map(node => {
                    if (node.id === existingGroupConnector.id) {
                      return {
                        ...node,
                        position: newConnectorPosition
                      }
                    }
                    return node
                  })
                })
              }
            })

            const updatedConnector = {
              ...existingGroupConnector,
              position: existingGroupConnector.position, // 초기 위치, DOM 렌더링 후 업데이트됨
              data: {
                ...existingGroupConnector.data,
                isConfirmed: true,
                isGroupBox: true,
                groupId: groupId,
                groupEdges: connectedEdges.map(e => e.id),
                nodeIds: Array.from(allConnectedNodeIds),
                savedSettings: {
                  ...currentSettings,
                  addedPartsIds: addedPartsIdsForExisting,
                  groupId: groupId,
                  connectorId: existingGroupConnector.id
                },
                hidden: false,
                isGroupToGroup: false
              }
            }

            updatedConnectorMap.set(existingGroupConnector.id, updatedConnector)
          } else if (!existingGroupConnector && !updatedConnectorMap.has(connectorId)) {
            let position = null
            
            // DOM 렌더링 완료 후 커넥터 위치 계산
            calculateConnectorPositionCallback(connectedEdges, nds, rfInstance).then(calculatedPosition => {
              if (calculatedPosition) {
                setNodes((currentNodes) => {
                  return currentNodes.map(node => {
                    if (node.id === connectorId) {
                      return {
                        ...node,
                        position: calculatedPosition
                      }
                    }
                    return node
                  })
                })
              }
            })

            if (!position) {
              const groupPartNodes = nds.filter(n =>
                n && allConnectedNodeIds.has(n.id) && n.type === 'partNode'
              )
              const firstNode = groupPartNodes[0]
              const labelX = firstNode ? firstNode.position.x + 90 : 0
              const labelY = firstNode ? firstNode.position.y + 200 + 60 : 0
              position = { x: labelX, y: labelY }
            }

            const groupPartNodes = nds.filter(n =>
              n && allConnectedNodeIds.has(n.id) && n.type === 'partNode'
            )
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
                savedSettings: {
                  ...currentSettings,
                  addedPartsIds: addedPartsIdsForNew,
                  groupId: groupId,
                  connectorId: connectorId
                },
                hidden: false,
                isGroupToGroup: false
              },
              zIndex: 1001
            }

            updatedConnectorMap.set(connectorId, newConnector)
          }

          const childGroupConnectorIds = hideChildGroupConnectors(addedPartsIds, nds, existingConnectorMap, groupConnectorNodes, updatedConnectorMap)

          existingConnectorMap.forEach((existingConnector, connectorId) => {
            if (!updatedConnectorMap.has(connectorId)) {
              if (!childGroupConnectorIds.has(connectorId)) {
                if (existingConnector.data?.isConfirmed === true && !existingConnector.data?.hidden) {
                  updatedConnectorMap.set(connectorId, existingConnector)
                } else if (existingConnector.data?.isGroupBox === true && !existingConnector.data?.hidden) {
                  updatedConnectorMap.set(connectorId, existingConnector)
                }
              }
            }
          })

          const finalConnectors = Array.from(updatedConnectorMap.values())

          confirmingRef.current.delete(id)
          
          // 확정 완료 시 설정패널 닫기
          setTimeout(() => {
            setShowSettingsPanel(false)
            setSelectedNodeId(null)
          }, 0)

          return [...filteredNodes, ...finalConnectors]
        })

        return updatedEdges
      }

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
              draggable: true,
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
          
          // 확정 완료 시 설정패널 닫기
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
  }, [rfInstance, setNodes, setEdges, handleEdgeDelete, handleNodeSettingsClick, setShowSettingsPanel, setFocusField, settingsDataRef, setAddedParts, calculateConnectorPositionCallback, addedPartsRef, confirmingRef, setIsEdgeConfirmed, updateEdgeLabelsCallback])

  // handleNodeConfirm를 ref에 저장
  handleNodeConfirmRef.current = handleNodeConfirm

  // 노드 드래그 핸들러들
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
            if (n.id === node.id) {
              return n
            }
            
            if (n.type === 'partNode' && n.data?.isConfirmed === true) {
              return n
            }
            
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
