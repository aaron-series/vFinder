import { EditorUtils } from '../helper'
import { findGroupConnector as findGroupConnectorHelper } from './nodeHelpers'

// 확정된 그룹 데이터 수집 헬퍼 함수
export const collectConfirmedGroupData = (nodes) => {
  const confirmedNodeIds = new Set()
  const confirmedConnectorIds = new Set()

  nodes.forEach(node => {
    if (node && node.type === 'groupConnector' && node.data?.isConfirmed === true) {
      confirmedConnectorIds.add(node.id)
      // 다중 노드 그룹: nodeIds 확인
      if (node.data?.nodeIds && Array.isArray(node.data.nodeIds)) {
        node.data.nodeIds.forEach(id => confirmedNodeIds.add(id))
      }
      // 단일 노드 그룹: nodeId 확인
      if (node.data?.nodeId) {
        confirmedNodeIds.add(node.data.nodeId)
      }
    }
  })

  return { confirmedNodeIds, confirmedConnectorIds }
}

// 그룹 내 연결된 edge 찾기 헬퍼 함수
export const findConnectedEdgesInGroup = (startNodeId, unconfirmedEdges, confirmedNodeIds, confirmedConnectorIds, visited = new Set(), visitedConnectors = new Set()) => {
  if (visited.has(startNodeId)) return []

  // 확정된 그룹에 속한 노드면 중단 (그룹 내부로 들어가지 않음)
  if (confirmedNodeIds.has(startNodeId)) return []

  // 확정된 그룹 connector를 만나면:
  // - connector 자체는 그룹의 일부로 인정 (edge는 추가하지 않지만 connector는 인식)
  // - 하지만 그 connector를 통해 더 이상 탐색하지 않음 (다른 그룹으로 넘어가지 않도록)
  if (confirmedConnectorIds.has(startNodeId)) {
    // 이미 방문한 connector면 중단
    if (visitedConnectors.has(startNodeId)) return []
    visitedConnectors.add(startNodeId)
    return [] // connector를 통해 더 이상 탐색하지 않음
  }

  visited.add(startNodeId)
  const connected = []
  unconfirmedEdges.forEach(edge => {
    if (edge.source === startNodeId || edge.target === startNodeId) {
      connected.push(edge)
      const nextNodeId = edge.source === startNodeId ? edge.target : edge.source
      connected.push(...findConnectedEdgesInGroup(nextNodeId, unconfirmedEdges, confirmedNodeIds, confirmedConnectorIds, visited, visitedConnectors))
    }
  })
  return connected
}

// 그룹의 addedParts를 위한 노드 수집 헬퍼 함수
export const collectGroupNodesForAddedParts = (groupNodeIds, nodes, confirmedNodeIds, confirmedConnectorIds, caseInfo) => {
  const addedParts = []

  // 먼저 확정된 그룹 connector 추가 (다중 노드 그룹과 단일 노드 그룹 모두)
  groupNodeIds.forEach(nodeId => {
    const node = EditorUtils.findNode(nodes, nodeId)
    if (node && node.type === 'groupConnector' && node.data?.isConfirmed === true) {
      // 이미 추가되지 않았으면 추가
      if (!addedParts.some(p => p.id === node.id)) {
        addedParts.push(node)
      }
    }
  })

  // 그 다음 partNode 추가 (확정된 그룹에 속하지 않은 노드만)
  groupNodeIds.forEach(nodeId => {
    // 확정된 그룹에 속한 노드는 제외
    if (confirmedNodeIds.has(nodeId)) return

    // 확정된 그룹 connector도 제외 (이미 위에서 추가됨)
    if (confirmedConnectorIds.has(nodeId)) return

    const node = EditorUtils.findNode(nodes, nodeId)
    if (node && node.type === 'partNode') {
      // 이미 추가되지 않았으면 추가
      if (!addedParts.some(p => p.id === node.id)) {
        addedParts.push(node)
      }
    }
  })

  return addedParts
}

// 케이스 5 특별 처리 헬퍼 함수
export const handleCase5SpecialLogic = (caseInfo, correctedSourceNode, correctedTargetNode, groupNodeIds, confirmedNodeIds) => {
  if (!caseInfo.isCase5) return

  // 단일 노드 그룹 connector 찾기
  const singleGroupConnector = caseInfo.isSourceSingleGroup
    ? correctedSourceNode
    : caseInfo.isTargetSingleGroup
      ? correctedTargetNode
      : null

  if (singleGroupConnector && singleGroupConnector.data?.isConfirmed === true) {
    // 단일 노드 그룹 connector를 groupNodeIds에 명시적으로 추가
    groupNodeIds.add(singleGroupConnector.id)

    // 단일 노드 그룹 connector의 nodeId도 추가 (확정된 노드 ID 수집에 포함)
    if (singleGroupConnector.data?.nodeId) {
      confirmedNodeIds.add(singleGroupConnector.data.nodeId)
    }

    // connection의 source/target도 단일노드그룹 connector ID로 업데이트
    if (caseInfo.isSourceSingleGroup) {
      groupNodeIds.add(correctedSourceNode.id)
    }
    if (caseInfo.isTargetSingleGroup) {
      groupNodeIds.add(correctedTargetNode.id)
    }
  }
}

// 확정되지 않은 그룹 connector 찾기 헬퍼 함수
export const findUnconfirmedGroupConnector = (startNodeId, connection, nodes) => {
  // startNodeId가 groupId인지 확인 (확정되지 않은 groupConnector의 groupId만)
  let groupConnector = nodes.find(n =>
    n && n.type === 'groupConnector' &&
    n.data?.isConfirmed === false &&
    (n.data?.groupId === startNodeId ||
      (n.data?.nodeId && EditorUtils.createSingleNodeGroupId(n.data.nodeId) === startNodeId))
  )

  // startNodeId가 groupId가 아닌 경우, 해당 노드가 속한 확정되지 않은 그룹 connector 찾기
  if (!groupConnector) {
    // connection의 source나 target이 확정되지 않은 그룹 connector인지 확인
    const sourceConnector = nodes.find(n =>
      n && n.type === 'groupConnector' &&
      n.data?.isConfirmed === false &&
      n.id === connection.source
    )
    const targetConnector = nodes.find(n =>
      n && n.type === 'groupConnector' &&
      n.data?.isConfirmed === false &&
      n.id === connection.target
    )

    if (sourceConnector) {
      groupConnector = sourceConnector
    } else if (targetConnector) {
      groupConnector = targetConnector
    } else {
      // startNodeId가 속한 확정되지 않은 그룹 connector 찾기
      // 다중 노드 그룹: nodeIds 확인
      groupConnector = nodes.find(n =>
        n && n.type === 'groupConnector' &&
        n.data?.isConfirmed === false &&
        n.data?.nodeIds &&
        Array.isArray(n.data.nodeIds) &&
        n.data.nodeIds.includes(startNodeId)
      )

      // 단일 노드 그룹: nodeId 확인
      if (!groupConnector) {
        groupConnector = nodes.find(n =>
          n && n.type === 'groupConnector' &&
          n.data?.isConfirmed === false &&
          n.data?.nodeId === startNodeId
        )
      }
    }
  }

  return groupConnector
}

// 연결된 모든 노드 찾기 (그룹 포함)
// 노드 ID나 그룹 connector ID를 받아서 연결된 모든 일반 노드를 반환
export const findAllConnectedNodesWithGroups = (startNodeId, currentNodes, currentEdges) => {
  // 안전성 체크
  if (!currentNodes || !Array.isArray(currentNodes) || !currentEdges || !Array.isArray(currentEdges)) {
    return []
  }

  // 그룹 connector 찾기 헬퍼
  const findGroupConnector = (nodeId) => {
    return currentNodes.find(n =>
      n && n.type === 'groupConnector' &&
      n.data?.isConfirmed === true &&
      !n.data?.hidden &&
      (n.data?.nodeIds?.includes(nodeId) || n.data?.nodeId === nodeId)
    )
  }

  // 그룹과 연결된 외부 노드/그룹 찾기 헬퍼 함수
  const findConnectedNodesFromGroup = (groupConnector, groupNodeIds, visited, visitedGroups) => {
    const result = []
    currentEdges.forEach(edge => {
      if (!edge) return
      const isSourceConnector = edge.source === groupConnector.id
      const isTargetConnector = edge.target === groupConnector.id
      const isSourceInGroup = groupNodeIds.includes(edge.source)
      const isTargetInGroup = groupNodeIds.includes(edge.target)

      // 그룹 내부 edge는 제외
      if ((isSourceInGroup && isTargetInGroup) || (isSourceConnector && isTargetInGroup) || (isTargetConnector && isSourceInGroup)) {
        return
      }

      // 그룹과 외부 노드를 연결하는 edge만 처리
      if (isSourceConnector || isTargetConnector || isSourceInGroup || isTargetInGroup) {
        let nextNodeId = null
        if (isSourceConnector) {
          nextNodeId = edge.target
        } else if (isTargetConnector) {
          nextNodeId = edge.source
        } else if (isSourceInGroup) {
          nextNodeId = edge.target
        } else if (isTargetInGroup) {
          nextNodeId = edge.source
        }

        if (nextNodeId && !groupNodeIds.includes(nextNodeId) && nextNodeId !== groupConnector.id) {
          const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
          result.push(...nextNodes)
        }
      }
    })
    return result
  }

  // 재귀적으로 연결된 모든 노드/그룹 찾기 (확정된 그룹은 connector로 반환)
  const findConnectedNodes = (nodeId, visited = new Set(), visitedGroups = new Set()) => {
    const node = EditorUtils.findNode(currentNodes, nodeId)
    if (!node) return []

    // 그룹 connector인 경우
    if (node.type === 'groupConnector' && node.data?.isConfirmed === true && !node.data?.hidden) {
      if (visitedGroups.has(nodeId)) return []
      visitedGroups.add(nodeId)
      const groupNodeIds = node.data?.nodeIds || [node.data?.nodeId].filter(Boolean)
      groupNodeIds.forEach(nId => visited.add(nId))
      return [node, ...findConnectedNodesFromGroup(node, groupNodeIds, visited, visitedGroups)]
    }

    // 확정된 그룹에 속한 노드인지 확인
    const groupConnector = findGroupConnector(nodeId)
    if (groupConnector) {
      if (visitedGroups.has(groupConnector.id)) return []
      visitedGroups.add(groupConnector.id)
      const groupNodeIds = groupConnector.data?.nodeIds || [groupConnector.data?.nodeId].filter(Boolean)
      groupNodeIds.forEach(nId => visited.add(nId))
      return [groupConnector, ...findConnectedNodesFromGroup(groupConnector, groupNodeIds, visited, visitedGroups)]
    }

    // 일반 노드인 경우
    if (visited.has(nodeId)) return []

    // 먼저 이 노드가 그룹에 속해 있는지 확인
    const nodeGroupConnector = findGroupConnector(nodeId)
    if (nodeGroupConnector) {
      if (visitedGroups.has(nodeGroupConnector.id)) return []
      visitedGroups.add(nodeGroupConnector.id)
      const groupNodeIds = nodeGroupConnector.data?.nodeIds || [nodeGroupConnector.data?.nodeId].filter(Boolean)
      groupNodeIds.forEach(nId => visited.add(nId))
      return [nodeGroupConnector, ...findConnectedNodesFromGroup(nodeGroupConnector, groupNodeIds, visited, visitedGroups)]
    }

    // 그룹에 속하지 않은 일반 노드인 경우
    visited.add(nodeId)
    const result = [node]

    // 직접 연결된 노드 찾기
    currentEdges.forEach(edge => {
      if (!edge) return
      if (edge.source === nodeId || edge.target === nodeId) {
        const nextNodeId = edge.source === nodeId ? edge.target : edge.source
        const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
        if (nextNodes && Array.isArray(nextNodes)) {
          result.push(...nextNodes)
        }
      }
    })

    return result
  }

  const allNodes = findConnectedNodes(startNodeId)
  // 중복 제거 후 partNode와 groupConnector만 반환 (확정된 그룹은 connector로 대체)
  if (!allNodes || !Array.isArray(allNodes)) {
    return []
  }
  const uniqueNodes = Array.from(new Map(allNodes.filter(n => n && n.id).map(n => [n.id, n])).values())
  return uniqueNodes.filter(n => n && (n.type === 'partNode' || n.type === 'groupConnector'))
}

// 연결된 모든 partNode 찾기
export const findAllConnectedPartNodes = (startNodeId, currentNodes, currentEdges) => {
  // 안전성 체크
  if (!currentNodes || !Array.isArray(currentNodes) || !currentEdges || !Array.isArray(currentEdges)) {
    return []
  }

  // 그룹 connector 찾기 헬퍼
  const findGroupConnector = (nodeId) => {
    return currentNodes.find(n =>
      n && n.type === 'groupConnector' &&
      n.data?.isConfirmed === true &&
      !n.data?.hidden &&
      (n.data?.nodeIds?.includes(nodeId) || n.data?.nodeId === nodeId)
    )
  }

  // 그룹 내부의 모든 일반 노드 찾기
  const getGroupPartNodes = (connectorId) => {
    const connector = EditorUtils.findConnector(currentNodes, connectorId)
    if (!connector || connector.type !== 'groupConnector') return []

    const groupNodeIds = connector.data?.nodeIds || (connector.data?.nodeId ? [connector.data.nodeId] : [])
    if (!Array.isArray(groupNodeIds)) return []

    return currentNodes.filter(n =>
      n && n.type === 'partNode' && groupNodeIds.includes(n.id)
    )
  }

  // 재귀적으로 연결된 모든 노드 찾기
  const findConnectedNodes = (nodeId, visited = new Set(), visitedGroups = new Set()) => {
    if (visited.has(nodeId)) return []

    const node = EditorUtils.findNode(currentNodes, nodeId)
    if (!node) return []

    // 그룹 connector인 경우
    if (node.type === 'groupConnector') {
      if (visitedGroups.has(nodeId)) return []
      visitedGroups.add(nodeId)

      const partNodes = getGroupPartNodes(nodeId)
      const result = [...partNodes]

      // 그룹과 연결된 다른 노드/그룹 찾기
      currentEdges.forEach(edge => {
        if (!edge) return
        const groupNodeIds = node.data?.nodeIds || (node.data?.nodeId ? [node.data.nodeId] : [])
        if (!Array.isArray(groupNodeIds)) return
        
        // 그룹 내부 노드와 연결된 edge 체크
        const isSourceInGroup = groupNodeIds.includes(edge.source)
        const isTargetInGroup = groupNodeIds.includes(edge.target)
        
        // 그룹 커넥터 자체와 직접 연결된 edge 체크 (그룹과 외부 노드/그룹 연결)
        const isSourceConnector = edge.source === nodeId
        const isTargetConnector = edge.target === nodeId

        if (isSourceInGroup || isTargetInGroup || isSourceConnector || isTargetConnector) {
          let nextNodeId = null
          if (isSourceInGroup) {
            nextNodeId = edge.target
          } else if (isTargetInGroup) {
            nextNodeId = edge.source
          } else if (isSourceConnector) {
            nextNodeId = edge.target
          } else if (isTargetConnector) {
            nextNodeId = edge.source
          }
          
          if (nextNodeId && !groupNodeIds.includes(nextNodeId)) {
            const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
            result.push(...nextNodes)
          }
        }
      })

      return result
    }

    // 일반 노드인 경우
    visited.add(nodeId)
    const result = [node]

    // 그룹에 속해 있는지 확인
    const groupConnector = findGroupConnector(nodeId)
    if (groupConnector && !visitedGroups.has(groupConnector.id)) {
      visitedGroups.add(groupConnector.id)
      const groupPartNodes = getGroupPartNodes(groupConnector.id)
      if (groupPartNodes && Array.isArray(groupPartNodes)) {
        result.push(...groupPartNodes.filter(n => n && n.id !== nodeId))
      }

      // 그룹과 연결된 다른 노드/그룹 찾기
      currentEdges.forEach(edge => {
        if (!edge) return
        const groupNodeIds = groupConnector.data?.nodeIds || (groupConnector.data?.nodeId ? [groupConnector.data.nodeId] : [])
        if (!Array.isArray(groupNodeIds)) return
        const isSourceInGroup = groupNodeIds.includes(edge.source)
        const isTargetInGroup = groupNodeIds.includes(edge.target)

        if (isSourceInGroup || isTargetInGroup) {
          const nextNodeId = isSourceInGroup ? edge.target : edge.source
          if (!groupNodeIds.includes(nextNodeId)) {
            const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
            result.push(...nextNodes)
          }
        }
      })
    } else {
      // 직접 연결된 노드 찾기
      currentEdges.forEach(edge => {
        if (!edge) return
        if (edge.source === nodeId || edge.target === nodeId) {
          const nextNodeId = edge.source === nodeId ? edge.target : edge.source
          const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
          if (nextNodes && Array.isArray(nextNodes)) {
            result.push(...nextNodes)
          }
        }
      })
    }

    return result
  }

  const allNodes = findConnectedNodes(startNodeId)
  // 중복 제거 후 partNode와 groupConnector만 반환 (확정된 그룹은 connector로 대체)
  if (!allNodes || !Array.isArray(allNodes)) {
    return []
  }
  const uniqueNodes = Array.from(new Map(allNodes.filter(n => n && n.id).map(n => [n.id, n])).values())
  return uniqueNodes.filter(n => n && (n.type === 'partNode' || n.type === 'groupConnector'))
}
