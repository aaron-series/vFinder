import { EditorUtils } from '../helper'
import { LABEL_BOX_HEIGHT } from '../constants'

// Edge 라벨 및 그룹 커넥터 업데이트 함수
export const updateEdgeLabels = (currentEdges, currentNodes, rfInst = null, handleEdgeDeleteFn = null, handleNodeSettingsClickFn = null, handleNodeConfirmFn = null, targetGroupId = null) => {
  // 안전성 체크
  if (!currentEdges || !Array.isArray(currentEdges) || !currentNodes || !Array.isArray(currentNodes)) {
    return { updatedEdges: currentEdges || [], groupConnectorNodes: [] }
  }

  // 확정된 그룹 연결포인트 찾기
  // hidden: true인 connector도 포함 (편집 모드에서 숨겨진 connector 유지)
  const confirmedConnectors = currentNodes.filter(
    node => node && node.type === 'groupConnector' &&
      node.data?.isConfirmed === true
    // hidden 상태와 관계없이 모든 확정된 connector 포함
  )

  // 확정된 그룹 정보 수집
  const confirmedGroups = new Map()
  confirmedConnectors.forEach(connector => {
    if (connector.data?.isGroupBox && connector.data?.groupEdges) {
      const groupId = connector.data.groupId || `group-${connector.id}`
      confirmedGroups.set(groupId, {
        connectorId: connector.id,
        connector,
        groupEdges: connector.data.groupEdges,
        level: connector.data.level || 1,
        nodeIds: connector.data.nodeIds || []
      })
    } else if (connector.data?.nodeId) {
      const groupId = `single-node-${connector.data.nodeId}`
      // targetGroupId가 지정된 경우, 해당 그룹의 connector만 포함
      if (targetGroupId && groupId !== targetGroupId) {
        // 다른 그룹의 connector는 스킵
      } else {
        confirmedGroups.set(groupId, {
          connectorId: connector.id,
          connector,
          groupEdges: [],
          level: connector.data.level || 1,
          nodeIds: [connector.data.nodeId]
        })
      }
    }
  })

  // 확정된 그룹에 속한 edge ID 수집
  const confirmedEdgeIds = new Set()
  confirmedGroups.forEach(group => {
    group.groupEdges.forEach(edgeId => confirmedEdgeIds.add(edgeId))
  })

  // 확정된 그룹에 속한 노드 ID 수집
  const confirmedNodeIds = new Set()
  confirmedGroups.forEach(group => {
    group.nodeIds.forEach(nodeId => confirmedNodeIds.add(nodeId))
  })

  // 확정되지 않은 edge만 그룹화
  const unconfirmedEdges = currentEdges.filter(edge => !confirmedEdgeIds.has(edge.id))

  // 재귀적으로 연결된 edge 찾기
  const findConnectedEdges = (startNodeId, visited = new Set()) => {
    if (visited.has(startNodeId)) return []
    visited.add(startNodeId)

    // 확정된 그룹에 속한 노드면 중단
    if (confirmedNodeIds.has(startNodeId)) return []

    const connected = []
    unconfirmedEdges.forEach(edge => {
      if (edge.source === startNodeId || edge.target === startNodeId) {
        connected.push(edge)
        const nextNodeId = edge.source === startNodeId ? edge.target : edge.source
        connected.push(...findConnectedEdges(nextNodeId, visited))
      }
    })
    return connected
  }

  // Edge 그룹화
  const edgeGroups = []
  const processedEdgeIds = new Set()

  unconfirmedEdges.forEach(edge => {
    if (processedEdgeIds.has(edge.id)) return

    const groupEdges = findConnectedEdges(edge.source)
    const uniqueEdges = Array.from(new Map(groupEdges.map(e => [e.id, e])).values())

    uniqueEdges.forEach(e => processedEdgeIds.add(e.id))

    if (uniqueEdges.length > 0) {
      edgeGroups.push(uniqueEdges)
    }
  })

  // 확정된 그룹도 edgeGroups에 추가 (독립적으로 관리)
  confirmedGroups.forEach((group, groupId) => {
    if (group.groupEdges.length > 0) {
      const groupEdges = currentEdges.filter(e => group.groupEdges.includes(e.id))
      if (groupEdges.length > 0) {
        edgeGroups.push(groupEdges)
      }
    }
  })

  // showLabel 관리: 확정된 edge의 showLabel은 절대 변경하지 않음
  const updatedEdges = currentEdges.map(edge => {
    // edge에 핸들러 추가 (없는 경우에만)
    const edgeData = {
      ...edge.data
    }

    // 핸들러가 없으면 추가 (확정된 edge도 포함)
    if (handleEdgeDeleteFn && !edgeData.onDelete) {
      edgeData.onDelete = handleEdgeDeleteFn
    }
    if (handleNodeSettingsClickFn) {
      // onSettingsClick 핸들러는 항상 최신으로 업데이트 (edge의 savedSettings를 사용하기 위해)
      // CustomEdge에서 edge.id를 파라미터로 전달하므로, 이를 그대로 사용
      edgeData.onSettingsClick = (edgeId) => {
        // edgeId가 전달되지 않으면 edge.id 사용
        const targetEdgeId = edgeId || edge.id
        handleNodeSettingsClickFn(targetEdgeId)
      }
    }

    // onConfirm 핸들러는 항상 최신 핸들러로 업데이트 (onConnect에서 생성된 edge의 잘못된 핸들러 덮어쓰기)
    if (handleNodeConfirmFn) {
      edgeData.onConfirm = () => {
        handleNodeConfirmFn(edge.id) // 기존에는 노드를 찾아 넘겼으나, 이제 엣지 ID를 직접 넘김
      }
    }

    // 확정된 edge는 showLabel 유지 (그룹 단위 정보 관리)
    if (edge.data?.isConfirmed) {
      return {
        ...edge,
        data: {
          ...edgeData,
          isConfirmed: true, // 확정 상태 유지
          showLabel: edge.data?.showLabel !== undefined ? edge.data.showLabel : true, // showLabel 명시적으로 유지
          savedSettings: edge.data?.savedSettings || edgeData.savedSettings // 저장된 설정 유지
        }
      }
    }

    // 그룹 내에서 showLabel 결정
    // 여러 노드가 연결된 경우: 그룹 내 하나의 edge만 showLabel: true, 나머지는 false
    let shouldShowLabel = false
    let isInGroup = false

    for (const group of edgeGroups) {
      if (group.some(e => e.id === edge.id)) {
        isInGroup = true

        // 그룹 내 확정된 edge 중 showLabel: true인 것이 있으면 유지
        const confirmedWithLabel = group.find(
          e => e.data?.isConfirmed && e.data?.showLabel === true
        )
        if (confirmedWithLabel) {
          shouldShowLabel = edge.id === confirmedWithLabel.id
          break
        }

        // 확정되지 않은 그룹: 기존에 showLabel: true였던 edge가 있으면 유지
        if (!group.some(e => e.data?.isConfirmed)) {
          const existingLabelEdge = group.find(e => e.data?.showLabel === true)
          if (existingLabelEdge) {
            // 기존에 showLabel: true였던 edge가 있으면 그것을 유지
            shouldShowLabel = edge.id === existingLabelEdge.id
          } else {
            // 기존에 showLabel: true였던 edge가 없으면 첫 번째 edge에만 라벨 표시
            // 그룹 내 여러 edge가 있으면 하나만 표시, 나머지는 숨김
            shouldShowLabel = group[0]?.id === edge.id
          }
        }
        break
      }
    }

    // 그룹에 속한 edge가 아니면 개별 edge로 처리 (단일 노드 연결이 아닌 경우)
    // 그룹에 속한 edge는 showLabel이 명시적으로 설정되어야 함
    if (isInGroup) {
      // 그룹 내 edge: showLabel 명시적으로 설정
      edgeData.showLabel = shouldShowLabel
    } else {
      // 그룹에 속하지 않은 edge: 기존 로직 유지 (단일 노드 연결 등)
      if (edge.data?.showLabel === true && shouldShowLabel === false) {
        edgeData.showLabel = true
      } else {
        edgeData.showLabel = shouldShowLabel
      }
    }

    return {
      ...edge,
      data: edgeData
    }
  })

  // 그룹 연결포인트 생성/업데이트
  const groupConnectorNodes = []

  // 확정된 그룹 연결포인트는 위치 유지
  confirmedConnectors.forEach(connector => {
    // 모든 확정된 connector는 항상 포함 (targetGroupId와 관계없이)
    if (connector.data?.isConfirmed === true) {
      groupConnectorNodes.push(connector)
    }
  })

  // 확정되지 않은 그룹의 connector도 찾아서 추가
  // edgeGroups가 비어있어도 기존 connector는 유지해야 함
  const unconfirmedConnectors = currentNodes.filter(
    node => node && node.type === 'groupConnector' &&
      node.data?.isConfirmed === false &&
      !node.data?.hidden &&
      node.data?.isGroupBox === true
  )

  // 확정되지 않은 connector를 groupConnectorNodes에 추가 (중복 제거)
  unconfirmedConnectors.forEach(connector => {
    // 이미 추가되지 않은 경우만 추가
    if (!groupConnectorNodes.some(c => c.id === connector.id)) {
      groupConnectorNodes.push(connector)
    }
  })

  // 새로운 그룹 연결포인트 생성 (확정되지 않은 그룹만, 단 targetGroupId가 지정된 경우는 확정된 그룹도 처리)
  edgeGroups.forEach((group, groupIndex) => {
    // 확정된 그룹은 이미 처리됨 (단, targetGroupId가 지정된 경우는 확정된 그룹도 처리)
    const isConfirmedGroup = group.some(e => e.data?.isConfirmed)
    if (isConfirmedGroup && !targetGroupId) return

    // 그룹에 속한 노드 찾기
    const groupNodeIds = new Set()
    group.forEach(edge => {
      groupNodeIds.add(edge.source)
      groupNodeIds.add(edge.target)
    })

    const groupNodes = currentNodes.filter(n =>
      n && groupNodeIds.has(n.id) && n.type === 'partNode'
    )

    // connector ID가 포함된 경우도 허용 (그룹과 그룹 연결 시)
    const hasConnectorIds = Array.from(groupNodeIds).some(nodeId => {
      const node = currentNodes.find(n => n && n.id === nodeId)
      return node && node.type === 'groupConnector'
    })

    // partNode가 없고 connector ID도 없으면 return
    if (groupNodes.length === 0 && !hasConnectorIds) return

    // 그룹 ID 생성 (노드 ID 기반으로 고유 ID 생성)
    const currentGroupId = EditorUtils.createGroupId(groupNodeIds)
    const connectorId = EditorUtils.createGroupConnectorId(currentGroupId)

    // targetGroupId가 지정된 경우, 해당 그룹만 처리
    if (targetGroupId && currentGroupId !== targetGroupId) {
      return
    }

    // edge의 확정 상태 확인 (그룹의 확정 상태 결정)
    const groupIsConfirmed = group.some(e => e.data?.isConfirmed === true)

    // 기존 connector 찾기
    const existingConnector = currentNodes.find(n => {
      if (!n || n.type !== 'groupConnector') {
        return false
      }
      // 확정되지 않은 그룹인 경우: 확정되지 않은 connector만 찾기
      if (!groupIsConfirmed && n.data?.isConfirmed !== false) {
        return false
      }
      // targetGroupId가 지정된 경우, 해당 그룹의 connector만 찾기
      if (targetGroupId) {
        const connectorGroupId = n.data?.groupId || (n.data?.nodeId ? `single-node-${n.data.nodeId}` : null)
        if (connectorGroupId !== targetGroupId) {
          return false
        }
      }
      
      // groupEdges를 우선 확인 (더 정확한 매칭)
      if (n.data?.groupEdges && Array.isArray(n.data.groupEdges) && group.length > 0) {
        const connectorEdgeIds = new Set(n.data.groupEdges)
        const groupEdgeIds = new Set(group.map(e => e.id))
        // groupEdges가 정확히 일치하거나 포함 관계인지 확인
        const hasExactEdgeMatch = groupEdgeIds.size === connectorEdgeIds.size &&
          Array.from(groupEdgeIds).every(edgeId => connectorEdgeIds.has(edgeId))
        if (hasExactEdgeMatch) {
          return true
        }
      }
      
      // groupEdges가 없거나 매칭되지 않은 경우, nodeIds로 확인
      // 단, groupNodeIds에 connector ID가 포함되어 있으면 제외 (그룹과 그룹 연결은 별도 처리)
      const existingNodeIds = new Set(n.data?.nodeIds || [])
      const groupNodeIdsArray = Array.from(groupNodeIds)
      const hasConnectorIdInGroup = groupNodeIdsArray.some(nodeId => {
        const node = currentNodes.find(n => n && n.id === nodeId)
        return node && node.type === 'groupConnector'
      })
      
      // groupNodeIds에 connector ID가 포함되어 있으면, nodeIds만으로는 매칭하지 않음
      if (hasConnectorIdInGroup) {
        return false
      }
      
      // 기존 connector의 nodeIds와 새로운 groupNodeIds가 겹치면 같은 그룹
      // 단, 모든 groupNodeIds가 existingNodeIds에 포함되어야 함 (부분 겹침이 아닌 완전 포함)
      const hasOverlap = groupNodeIdsArray.every(nodeId => existingNodeIds.has(nodeId))
      return hasOverlap
    })

    if (existingConnector) {
      // 그룹과 그룹 연결로 생성된 경우 isGroupToGroup 플래그 설정
      const isGroupToGroupConnection = hasConnectorIds && groupNodes.length === 0
      // 확정 상태 확인: edge의 확정 상태 또는 기존 connector의 확정 상태
      const isConfirmed = groupIsConfirmed || existingConnector.data?.isConfirmed === true

      // 확정된 커넥터의 위치는 보존 (다른 그룹/노드 연결 시 위치 변경 방지)
      const preservedPosition = existingConnector.data?.isConfirmed === true 
        ? existingConnector.position 
        : undefined

      // 기존 connector가 있으면 nodeIds, groupEdges, groupId 업데이트
      // 단, 기존 connector가 확정되어 있고 hidden이 false면, hidden 상태를 보존
      const shouldPreserveHidden = existingConnector.data?.isConfirmed === true && existingConnector.data?.hidden === false
      
      const updatedConnector = {
        ...existingConnector,
        id: connectorId, // 새로운 connectorId로 업데이트
        position: preservedPosition || existingConnector.position, // 확정된 경우 위치 보존
        data: {
          ...existingConnector.data,
          groupId: currentGroupId, // 새로운 groupId로 업데이트
          nodeIds: Array.from(groupNodeIds), // 새로운 노드 포함하여 업데이트
          groupEdges: group.map(e => e.id), // 새로운 edge 포함하여 업데이트
          hidden: shouldPreserveHidden ? false : !isConfirmed, // 기존 상태 보존 또는 확정된 그룹만 커넥터 표시
          isConfirmed: isConfirmed, // edge의 확정 상태 또는 기존 확정 상태
          isGroupToGroup: isGroupToGroupConnection && isConfirmed // 확정된 그룹과 그룹 연결만 isGroupToGroup 유지
        }
      }
      groupConnectorNodes.push(updatedConnector)
      return // 기존 connector 업데이트 완료
    }

    // 새로운 connector 생성 (기존에 없을 때만)
    let position = null

    if (group.length > 0) {
      let sumLabelX = 0
      let maxLabelY = 0

      group.forEach(edge => {
        const sourceNode = currentNodes.find(n => n && n.id === edge.source)
        const targetNode = currentNodes.find(n => n && n.id === edge.target)

        if (sourceNode && targetNode) {
          // 그룹 커넥터인 경우 실제 partNode들의 위치를 사용
          let sourceX = sourceNode.position.x
          let sourceY = sourceNode.position.y
          let targetX = targetNode.position.x
          let targetY = targetNode.position.y

          // source가 그룹 커넥터인 경우, 그룹 내 partNode들의 평균 위치 사용
          if (sourceNode.type === 'groupConnector' && sourceNode.data?.nodeIds) {
            const groupPartNodes = currentNodes.filter(n =>
              n && n.type === 'partNode' && sourceNode.data.nodeIds.includes(n.id)
            )
            if (groupPartNodes.length > 0) {
              const avgX = groupPartNodes.reduce((sum, n) => sum + n.position.x, 0) / groupPartNodes.length
              const avgY = groupPartNodes.reduce((sum, n) => sum + n.position.y, 0) / groupPartNodes.length
              sourceX = avgX
              sourceY = avgY
            }
          }

          // target이 그룹 커넥터인 경우, 그룹 내 partNode들의 평균 위치 사용
          if (targetNode.type === 'groupConnector' && targetNode.data?.nodeIds) {
            const groupPartNodes = currentNodes.filter(n =>
              n && n.type === 'partNode' && targetNode.data.nodeIds.includes(n.id)
            )
            if (groupPartNodes.length > 0) {
              const avgX = groupPartNodes.reduce((sum, n) => sum + n.position.x, 0) / groupPartNodes.length
              const avgY = groupPartNodes.reduce((sum, n) => sum + n.position.y, 0) / groupPartNodes.length
              targetX = avgX
              targetY = avgY
            }
          }

          // CustomEdge의 계산 방식과 동일: getSmoothStepPath의 labelX는 (sourceX + targetX) / 2
          const labelX = (sourceX + targetX) / 2
          const adjustedLabelY = Math.max(sourceY, targetY) + 180
          const labelY = adjustedLabelY + LABEL_BOX_HEIGHT // 라벨 박스 하단 위치

          sumLabelX += labelX
          maxLabelY = Math.max(maxLabelY, labelY)
        }
      })

      position = {
        x: sumLabelX,
        y: maxLabelY
      }
    }

    // edge의 확정 상태 확인 (그룹의 확정 상태 결정)
    const newGroupIsConfirmed = group.some(e => e.data?.isConfirmed === true)

    // 그룹과 그룹 연결로 생성된 경우 isGroupToGroup 플래그 설정
    const isGroupToGroupConnection = hasConnectorIds && groupNodes.length === 0
    // connector의 확정 상태: edge의 확정 상태에 따라 결정
    const isConfirmed = newGroupIsConfirmed

    groupConnectorNodes.push({
      id: connectorId,
      type: 'groupConnector',
      position: position,
      data: {
        isConfirmed: isConfirmed,
        isGroupBox: true,
        groupId: currentGroupId,
        groupEdges: group.map(e => e.id),
        nodeIds: Array.from(groupNodeIds),
        hidden: !isConfirmed, // 확정된 그룹만 커넥터 표시 (확정되지 않은 상태에서는 숨김)
        isGroupToGroup: isGroupToGroupConnection && !isConfirmed // 확정되지 않은 그룹과 그룹 연결만 isGroupToGroup 유지
      },
      zIndex: 1000
    })
  })

  // 단일 노드 연결포인트 처리
  // 케이스 5: 그룹(단일노드그룹)과 그룹(2개이상연결된그룹) 연결 처리
  const partNodes = currentNodes.filter(n =>
    n && n.type === 'partNode' &&
    n.data?.isConfirmed === true &&
    !confirmedNodeIds.has(n.id)
  )

  partNodes.forEach(node => {
    // 연결된 edge 확인 (확정된 edge도 포함)
    const connectedEdges = currentEdges.filter(
      e => (e.source === node.id || e.target === node.id)
    )

    // 케이스 5 확인: 단일 노드 그룹 connector가 다른 그룹 connector와 연결되었는지 확인
    let isCase5 = false
    let singleNodeConnector = null

    if (connectedEdges.length > 0) {
      // 단일 노드 connector 찾기
      const connectorId = EditorUtils.createSingleNodeConnectorId(node.id)
      singleNodeConnector = EditorUtils.findConnector(currentNodes, connectorId)

      if (singleNodeConnector && singleNodeConnector.data?.isConfirmed === true) {
        // 연결된 edge 중 하나라도 다른 그룹 connector와 연결되어 있는지 확인
        for (const edge of connectedEdges) {
          const otherNodeId = edge.source === node.id ? edge.target : edge.source
          const otherNode = EditorUtils.findNode(currentNodes, otherNodeId)

          // 다른 노드가 그룹 connector이고, 다중 노드 그룹인 경우
          if (otherNode &&
            otherNode.type === 'groupConnector' &&
            otherNode.data?.isGroupBox === true) {
            isCase5 = true
            break
          }
        }
      }
    }

    // 케이스 5인 경우: 단일 노드 그룹 connector를 hidden: true로 설정
    if (isCase5 && singleNodeConnector) {
      groupConnectorNodes.push({
        ...singleNodeConnector,
        data: {
          ...singleNodeConnector.data,
          hidden: true, // 케이스 5: 다른 그룹과 연결되었으므로 숨김
          isConfirmed: true
        }
      })
      return // 케이스 5 처리 완료
    }

    // 케이스 5가 아닌 경우: 기존 로직 유지
    if (connectedEdges.length > 0) return // edge가 있으면 그룹 연결포인트로 처리됨

    const singleNodeGroupId = EditorUtils.createSingleNodeGroupId(node.id)

    // targetGroupId가 지정된 경우, 해당 그룹의 connector만 처리
    if (targetGroupId && singleNodeGroupId !== targetGroupId) return

    const connectorId = EditorUtils.createSingleNodeConnectorId(node.id)

    // 기존 connector 찾기 (타입 체크 없이 ID만으로 찾기 - 숨겨진 것도 포함)
    const existingConnector = EditorUtils.findConnector(currentNodes, connectorId)

    if (existingConnector) {
      // 기존 connector가 있으면 hidden을 false로 설정 (확정 시 보여짐 - 연결선 생성 가능)
      // 기존 connector의 position과 모든 속성을 유지하면서 data만 업데이트
      groupConnectorNodes.push({
        id: existingConnector.id,
        type: existingConnector.type || 'groupConnector',
        position: existingConnector.position,
        data: {
          ...existingConnector.data,
          hidden: false, // 확정 시 보여짐 (연결선 생성 가능)
          isConfirmed: true,
          isGroupBox: false, // 명시적으로 false 설정 (단일 노드 커넥터)
          nodeId: node.id // nodeId 명시적으로 설정
        },
        zIndex: existingConnector.zIndex || 1001
      })
    } else {
      // 기존 connector가 없으면 새로 생성 (확정 시 보여짐 - 연결선 생성 가능)
      const labelX = node.position.x + 90
      const labelY = node.position.y + 200 + 60

      groupConnectorNodes.push({
        id: connectorId,
        type: 'groupConnector',
        position: { x: labelX, y: labelY },
        data: {
          isConfirmed: true,
          isGroupBox: false,
          nodeId: node.id,

          hidden: false // 확정 시 보여짐 (연결선 생성 가능)
        },
        zIndex: 1001
      })
    }
  })

  return {
    updatedEdges,
    groupConnectorNodes
  }
}
