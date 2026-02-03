import { useState, useCallback, useRef, useEffect } from 'react'
import { addEdge, MarkerType } from 'reactflow'
import { EditorUtils } from '../helper'
import { getConnectionCase, correctConnectionForCase5, findNearestHandle } from '../utils/connectionHelpers'
import { findAllConnectedPartNodes } from '../utils/groupHelpers'
import { INITIAL_SETTINGS_DATA } from '../constants'

/**
 * 엣지 연결 및 자석 효과 처리 훅
 */
export const useConnectionHandler = ({
  nodes,
  edges,
  setNodes,
  setEdges,
  rfInstance,
  handleNodeEdit,
  handleNodeConfirm,
  handleNodeSettingsClick,
  handleEdgeDelete,
  updateEdgeLabelsCallback,
  syncConnectorPositionsCallback,
  setAddedParts,
  setSettingsData,
  setSelectedNodeId,
  setShowSettingsPanel
}) => {
  const [connectionLineType, setConnectionLineType] = useState('smoothstep')
  const connectingRef = useRef(null)

  // 1. 단일 노드 자동 커넥터 생성 (useEffect 로직 이동)
  useEffect(() => {
    if (!rfInstance || !nodes || !edges) return

    setNodes((currentNodes) => {
      const partNodes = currentNodes.filter(n => n && n.type === 'partNode' && !n.data?.isConfirmed)
      const updatedNodes = [...currentNodes]
      let hasChanges = false

      partNodes.forEach(node => {
        const hasEdge = (edges || []).some(e => e && (e.source === node.id || e.target === node.id))
        if (!hasEdge) {
          const connectorId = EditorUtils.createSingleNodeConnectorId(node.id)
          const existingConnector = EditorUtils.findConnector(currentNodes, connectorId)

          if (!existingConnector) {
            const labelX = node.position.x + 90
            const labelY = node.position.y + 260
            updatedNodes.push({
              id: connectorId,
              type: 'groupConnector',
              position: { x: labelX, y: labelY },
              data: {
                isConfirmed: false,
                isGroupBox: false,
                nodeId: node.id,
                hidden: false
              },
              zIndex: 1001
            })
            hasChanges = true
          }
        }
      })
      return hasChanges ? updatedNodes : currentNodes
    })
  }, [nodes.length, rfInstance, setNodes, edges])

  // 2. 연결 시작 (자석 효과 활성화)
  const onConnectStart = useCallback((event, { nodeId, handleType, handleId }) => {
    if (!rfInstance) return

    const sourceNode = EditorUtils.findNode(nodes, nodeId)
    if (!sourceNode) return

    let sourcePosition = 'bottom'
    if (sourceNode.type === 'partNode') {
      if (handleId === 'top') sourcePosition = 'top'
      else if (handleId === 'bottom') sourcePosition = 'bottom'
      else if (handleId === 'left') sourcePosition = 'left'
      else if (handleId === 'right') sourcePosition = 'right'
    }

    connectingRef.current = {
      sourceNodeId: nodeId,
      sourcePosition,
      handleType,
      handleId,
    }

    const handleMouseMove = (e) => {
      if (!rfInstance || !connectingRef.current) return
      const flowPosition = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      findNearestHandle(flowPosition.x, flowPosition.y, nodes, rfInstance)
    }

    document.addEventListener('mousemove', handleMouseMove)
    connectingRef.current.mouseMoveHandler = handleMouseMove
  }, [rfInstance, nodes])

  const onConnectEnd = useCallback(() => {
    if (connectingRef.current?.mouseMoveHandler) {
      document.removeEventListener('mousemove', connectingRef.current.mouseMoveHandler)
    }
    connectingRef.current = null
    setConnectionLineType('smoothstep')
  }, [])

  useEffect(() => {
    return () => {
      if (connectingRef.current?.mouseMoveHandler) {
        document.removeEventListener('mousemove', connectingRef.current.mouseMoveHandler)
      }
    }
  }, [])

  // 3. 연결 생성 (onConnect)
  const onConnect = useCallback((connection) => {
    if (!connection.source || !connection.target) return
    if (!rfInstance) return
    if (connection.source === connection.target) return

    const sourceNode = EditorUtils.findNode(nodes, connection.source)
    if (!sourceNode) return

    if (sourceNode.type === 'groupConnector') {
      if (!sourceNode.data?.isConfirmed || sourceNode.data?.hidden) return
    }

    const targetNode = EditorUtils.findNode(nodes, connection.target)
    if (targetNode?.type === 'groupConnector') {
      if (!targetNode.data?.isConfirmed || targetNode.data?.hidden) return
    }

    const currentNodes = nodes
    const { correctedSource, correctedTarget } = correctConnectionForCase5(connection, currentNodes)
    if (correctedSource === correctedTarget) return

    // 노드 정렬 (Case 1)
    setNodes((nds) => {
        const sNode = EditorUtils.findNode(nds, correctedSource)
        const tNode = EditorUtils.findNode(nds, correctedTarget)
        if(sNode && tNode) {
            const caseInfo = getConnectionCase(sNode, tNode)
            if(caseInfo.isCase1) {
                return nds.map(n => n.id === correctedTarget ? {...n, position: {...n.position, y: sNode.position.y}} : n)
            }
        }
        return nds
    })

    const newEdge = {
      id: EditorUtils.createEdgeId(edges),
      source: correctedSource,
      target: correctedTarget,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'custom',
      data: {
        step: 'STEP.',
        stepValue: '',
        isConfirmed: false,
        showLabel: true,
        onEdit: (edgeId) => handleNodeEdit(edgeId),
        onConfirm: (edgeId) => handleNodeConfirm(edgeId),
        onStepChange: (edgeId, value) => {
          setEdges((eds) => eds.map(e => e.id === edgeId ? { ...e, data: { ...e.data, stepValue: value } } : e))
        },
        onSettingsClick: (edgeId) => handleNodeSettingsClick(edgeId)
      },
      markerEnd: { type: MarkerType.ArrowClosed },
    }

    setEdges((eds) => {
        const updatedEdges = addEdge(newEdge, eds)
        
        setNodes((nds) => {
            const updatedNodes = nds.map(node => {
                if ((node.id === correctedSource || node.id === correctedTarget) && node.type === 'partNode') {
                    return { ...node, data: { ...node.data, hasConnectedEdge: true } }
                }
                return node
            })
            
            // Added Parts 자동 설정
            const sourceNode = EditorUtils.findNode(updatedNodes, correctedSource)
            const targetNode = EditorUtils.findNode(updatedNodes, correctedTarget)
            
            if (sourceNode && targetNode) {
                const isSourceGroupConnector = sourceNode.type === 'groupConnector'
                const isTargetGroupConnector = targetNode.type === 'groupConnector'
                
                if (isSourceGroupConnector || isTargetGroupConnector) {
                    const partsToAdd = []
                    if (isSourceGroupConnector) partsToAdd.push(sourceNode)
                    else if (sourceNode.type === 'partNode') partsToAdd.push(sourceNode)
                    
                    if (isTargetGroupConnector) {
                        if (!partsToAdd.find(p => p.id === targetNode.id)) partsToAdd.push(targetNode)
                    } else if (targetNode.type === 'partNode' && targetNode.id !== sourceNode.id) {
                        partsToAdd.push(targetNode)
                    }
                    
                    if (partsToAdd.length > 0) {
                        setTimeout(() => {
                            setAddedParts(partsToAdd)
                            setSettingsData(INITIAL_SETTINGS_DATA)
                            setSelectedNodeId(newEdge.id)
                            setShowSettingsPanel(true)
                        }, 0)
                    }
                } else {
                    const connectedPartNodes = findAllConnectedPartNodes(correctedSource, updatedNodes, updatedEdges)
                    setTimeout(() => {
                        setAddedParts(connectedPartNodes?.length > 0 ? connectedPartNodes : [sourceNode, targetNode])
                        setSettingsData(INITIAL_SETTINGS_DATA)
                        setSelectedNodeId(newEdge.id)
                        setShowSettingsPanel(true)
                    }, 0)
                }
            }
            return updatedNodes
        })
        
        // Edge Label 및 Connector 업데이트
        setEdges(curEdges => {
            setNodes(curNodes => {
                const { updatedEdges, groupConnectorNodes } = updateEdgeLabelsCallback(curEdges, curNodes, rfInstance, handleEdgeDelete, handleNodeSettingsClick, handleNodeConfirm, null, null)
                
                const filteredNodes = curNodes.filter(n => n && n.type !== 'groupConnector')
                const existingConnectorMap = new Map(curNodes.filter(n => n && n.type === 'groupConnector').map(n => [n.id, n]))
                const updatedConnectorMap = new Map()
                
                if (groupConnectorNodes) {
                    groupConnectorNodes.forEach(newConnector => {
                        const existing = existingConnectorMap.get(newConnector.id)
                        if (existing?.data?.isConfirmed === true && existing?.data?.hidden === false) {
                            updatedConnectorMap.set(newConnector.id, { ...newConnector, data: { ...newConnector.data, hidden: false, isConfirmed: true } })
                        } else {
                            updatedConnectorMap.set(newConnector.id, newConnector)
                        }
                    })
                }
                
                existingConnectorMap.forEach((existing, id) => {
                    if (!updatedConnectorMap.has(id)) {
                        if ((existing.data?.isConfirmed || existing.data?.isGroupBox) && !existing.data?.hidden) {
                            updatedConnectorMap.set(id, existing)
                        }
                    }
                })
                
                const finalConnectors = Array.from(updatedConnectorMap.values())
                setEdges(updatedEdges)
                
                syncConnectorPositionsCallback([...filteredNodes, ...finalConnectors], updatedEdges).then(updated => {
                    if (updated) setNodes(updated)
                })
                
                return [...filteredNodes, ...finalConnectors]
            })
            return curEdges
        })

        return updatedEdges
    })
  }, [rfInstance, nodes, edges, setNodes, setEdges, handleNodeEdit, handleNodeConfirm, handleNodeSettingsClick, updateEdgeLabelsCallback, handleEdgeDelete, syncConnectorPositionsCallback, setAddedParts, setSettingsData, setSelectedNodeId, setShowSettingsPanel])

  return { onConnect, onConnectStart, onConnectEnd, connectionLineType }
}