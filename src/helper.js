// Editor 유틸리티 함수들
export const EditorUtils = {
  // 노드 찾기
  findNode: (nodes, nodeId) => nodes.find(n => n && n.id === nodeId),

  // 엣지 찾기
  findEdge: (edges, edgeId) => edges.find(e => e && e.id === edgeId),

  // 커넥터 찾기
  findConnector: (nodes, connectorId) => nodes.find(n => n && n.id === connectorId),

  // 노드 ID 생성 (3자리 순차 번호: node-001, node-002, ...)
  createNodeId: (existingNodes) => {
    let maxNum = 0
    existingNodes.forEach(node => {
      if (node && node.id && node.id.startsWith('node-')) {
        // node-001 형식 파싱
        const match = node.id.match(/^node-(\d{1,3})(?:-.*)?$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxNum && num <= 999) maxNum = num
        }
      }
    })
    // 다음 번호 생성 (1-999 범위)
    const nextNum = Math.min(maxNum + 1, 999)
    if (nextNum > 999) {
      console.warn('Node ID limit reached (999). Using fallback timestamp.')
      return `node-${Date.now()}`
    }
    return `node-${String(nextNum).padStart(3, '0')}`
  },

  // 엣지 ID 생성 (3자리 순차 번호: edge-001, edge-002, ...)
  createEdgeId: (existingEdges) => {
    let maxNum = 0
    existingEdges.forEach(edge => {
      if (edge && edge.id && edge.id.startsWith('edge-')) {
        // edge-001 형식 파싱 (edge-001-source-target 같은 형식도 처리)
        const match = edge.id.match(/^edge-(\d{1,3})(?:-.*)?$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxNum && num <= 999) maxNum = num
        }
      }
    })
    // 다음 번호 생성 (1-999 범위)
    const nextNum = Math.min(maxNum + 1, 999)
    if (nextNum > 999) {
      console.warn('Edge ID limit reached (999). Using fallback timestamp.')
      return `edge-${Date.now()}`
    }
    return `edge-${String(nextNum).padStart(3, '0')}`
  },

  // 그룹 ID 생성
  createGroupId: (nodeIds) => {
    const sortedNodeIds = Array.from(nodeIds).sort()
    return `${sortedNodeIds.join('-')}`
  },

  // 그룹 커넥터 ID 생성
  createGroupConnectorId: (groupId) => `group-connector-${groupId}`,

  // 단일 노드 그룹 ID 생성
  createSingleNodeGroupId: (nodeId) => `single-${nodeId}`,

  // 단일 노드 커넥터 ID 생성
  createSingleNodeConnectorId: (nodeId) => `single-connector-${nodeId}`,

  // 커넥터 맵 생성
  createConnectorMap: (nodes) => {
    return new Map(
      nodes
        .filter(n => n && n.type === 'groupConnector')
        .map(n => [n.id, n])
    )
  },

  // 일반 노드 필터링 (커넥터 제외)
  filterPartNodes: (nodes) => nodes.filter(n => n && n.type !== 'groupConnector'),

  // 커넥터 업데이트 맵 생성
  createUpdatedConnectorMap: (groupConnectorNodes, existingConnectorMap, currentNodes) => {
    const updatedConnectorMap = new Map()

    // updateEdgeLabels가 반환한 connector로 업데이트
    groupConnectorNodes.forEach(newConnector => {
      // 단일 노드 커넥터인 경우, 모든 필요한 속성을 명시적으로 설정
      if (newConnector.data?.nodeId && !newConnector.data?.isGroupBox) {
        updatedConnectorMap.set(newConnector.id, {
          ...newConnector,
          data: {
            ...newConnector.data,
            isConfirmed: true,
            isGroupBox: false,
            nodeId: newConnector.data.nodeId,
            hidden: false
          }
        })
      } else {
        updatedConnectorMap.set(newConnector.id, newConnector)
      }
    })

    // 기존 connector 중 updateEdgeLabels가 반환하지 않은 것도 유지
    existingConnectorMap.forEach((existingConnector, connectorId) => {
      if (!updatedConnectorMap.has(connectorId)) {
        // 단일 노드 connector인 경우, 해당 노드가 확정되어 있으면 유지하고 hidden을 false로 설정
        if (existingConnector.data?.nodeId) {
          const nodeId = existingConnector.data.nodeId
          const node = EditorUtils.findNode(currentNodes, nodeId)
          if (node && node.data?.isConfirmed === true) {
            updatedConnectorMap.set(connectorId, {
              ...existingConnector,
              data: {
                ...existingConnector.data,
                hidden: false, // 단일 노드 재확정 시 hidden을 false로 설정
                isConfirmed: true,
                isGroupBox: false, // 명시적으로 false 설정 (단일 노드 커넥터)
                nodeId: nodeId // nodeId 유지
              }
            })
          }
        } else if (existingConnector.data?.isConfirmed === true && !existingConnector.data?.hidden) {
          // 확정되고 숨겨지지 않은 그룹 connector는 유지
          updatedConnectorMap.set(connectorId, existingConnector)
        }
      } else {
        // updateEdgeLabels가 반환한 connector가 있는 경우, 단일 노드 connector인지 확인하고 hidden을 false로 보장
        const updatedConnector = updatedConnectorMap.get(connectorId)
        if (updatedConnector && updatedConnector.data?.nodeId && updatedConnector.data?.isConfirmed === true) {
          updatedConnectorMap.set(connectorId, {
            ...updatedConnector,
            data: {
              ...updatedConnector.data,
              hidden: false, // 단일 노드 재확정 시 hidden을 false로 명시적으로 설정
              isGroupBox: false, // 명시적으로 false 설정 (단일 노드 커넥터)
              nodeId: updatedConnector.data.nodeId // nodeId 유지
            }
          })
        }
      }
    })

    return updatedConnectorMap
  }
}
