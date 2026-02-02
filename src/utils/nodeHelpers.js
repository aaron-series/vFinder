import { EditorUtils } from '../helper'

// 그룹 커넥터 찾기 헬퍼 함수
export const findGroupConnector = (connectorId, groupId, connectedEdges, nodes) => {
  // 방법 1: savedSettings에 저장된 connectorId나 groupId로 직접 찾기 (가장 정확)
  let existingGroupConnector = nodes.find(n =>
    n && n.type === 'groupConnector' &&
    (n.id === connectorId || n.data?.groupId === groupId)
  )

  // 방법 2: connectedEdges를 기반으로 찾기 (fallback, savedSettings가 없는 경우)
  if (!existingGroupConnector) {
    const connectedEdgeIds = new Set(connectedEdges.map(e => e.id))
    existingGroupConnector = nodes.find(n => {
      if (!n || n.type !== 'groupConnector' || !n.data?.groupEdges) {
        return false
      }
      const connectorEdgeIds = new Set(n.data.groupEdges)
      const isExactMatch =
        connectorEdgeIds.size === connectedEdgeIds.size &&
        Array.from(connectorEdgeIds).every(edgeId => connectedEdgeIds.has(edgeId))
      return isExactMatch
    })
  }

  return existingGroupConnector
}

// 커넥터 매칭 확인 헬퍼 함수
export const isMatchingConnector = (newConnector, groupId, connectorId, connectedEdges) => {
  // connectorId나 groupId로 직접 매칭 확인 (가장 정확)
  const isMatching = newConnector.data?.groupId === groupId || newConnector.id === connectorId

  // fallback: groupEdges가 완전히 일치하는지 확인 (savedSettings가 없는 경우)
  let shouldMatch = isMatching
  if (!shouldMatch && newConnector.data?.groupEdges) {
    const connectedEdgeIds = new Set(connectedEdges.map(e => e.id))
    const connectorEdgeIds = new Set(newConnector.data.groupEdges)
    const isExactMatch =
      connectorEdgeIds.size === connectedEdgeIds.size &&
      Array.from(connectorEdgeIds).every(edgeId => connectedEdgeIds.has(edgeId))
    if (isExactMatch) {
      shouldMatch = true
    }
  }

  // 확정된 그룹의 connector인 경우 항상 매칭 (편집 모드에서 다시 확정하는 경우)
  if (!shouldMatch && newConnector.data?.isConfirmed === true && newConnector.data?.groupId === groupId) {
    shouldMatch = true
  }

  return shouldMatch
}

// 하위 그룹 connector 숨김 처리 헬퍼 함수
export const hideChildGroupConnectors = (addedPartsIds, nodes, existingConnectorMap, groupConnectorNodes, updatedConnectorMap) => {
  const childGroupConnectorIds = new Set()
  addedPartsIds.forEach(nodeId => {
    const node = EditorUtils.findNode(nodes, nodeId)
    if (node && node.type === 'groupConnector') {
      childGroupConnectorIds.add(nodeId)
    }
  })

  // 1. existingConnectorMap에서 찾기
  childGroupConnectorIds.forEach(childConnectorId => {
    const childConnector = existingConnectorMap.get(childConnectorId)
    if (childConnector && childConnector.data?.isConfirmed === true) {
      updatedConnectorMap.set(childConnectorId, {
        ...childConnector,
        data: {
          ...childConnector.data,
          hidden: true,
          isConfirmed: true
        }
      })
    }
  })

  // 2. updateEdgeLabels가 반환한 groupConnectorNodes에서도 찾기 (재확정 시)
  if (groupConnectorNodes && Array.isArray(groupConnectorNodes)) {
    groupConnectorNodes.forEach(newConnector => {
      if (childGroupConnectorIds.has(newConnector.id)) {
        updatedConnectorMap.set(newConnector.id, {
          ...newConnector,
          data: {
            ...newConnector.data,
            hidden: true,
            isConfirmed: true
          }
        })
      }
    })
  }

  return childGroupConnectorIds
}
