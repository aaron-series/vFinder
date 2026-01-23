# RoutingTreeEditor 규칙 분석

## 1. 노드 생성 규칙

### 1.1 파츠 드롭으로 노드 생성 (`onDrop`)
- **위치**: `1692-1757` 라인
- **규칙**:
  1. 드래그된 파츠가 있어야 함 (`draggedPart` 존재)
  2. 노드 ID는 `node-${Date.now()}` 형식으로 생성
  3. 노드 타입은 `partNode`
  4. 노드 위치는 드롭 위치 기준으로 계산 (중앙 정렬)
  5. 텍스트 노드인 경우 너비는 400px, 일반 노드는 180px
  6. 새 노드는 기본적으로 `draggable: true`
  7. 초기 데이터:
     - `label`: 텍스트 노드면 빈 문자열, 아니면 파츠 코드
     - `number`: 현재 노드 개수 + 1
     - `isLastNode: true`
     - `step: 'STEP.'`
     - `stepValue: ''`
     - `hasConnectedEdge: false`
     - `isConfirmed: false`
  8. 새 노드 생성 시 기존 노드들의 `isLastNode`를 `false`로 변경
  9. 새 노드 생성 후 100ms 후 설정 패널 자동으로 열림

### 1.2 노드 초기화 규칙
- **위치**: `1705-1732` 라인
- **규칙**:
  1. 모든 노드에 핸들러 함수 연결:
     - `onDelete`: `handleNodeDelete`
     - `onLabelChange`: `handleNodeLabelChange`
     - `onTextChange`: `handleNodeTextChange`
     - `onSettingsClick`: `handleNodeSettingsClick`
     - `onStepChange`: `handleNodeStepChange`
     - `onConfirm`: `handleNodeConfirm`
     - `onEdit`: `handleNodeEdit`
  2. 확정된 노드는 `draggable: false`

---

## 2. 연결(Edge) 규칙

### 2.1 Edge 생성 (`onConnect`)
- **위치**: `1370-1513` 라인
- **규칙**:
  1. 새 edge는 `type: 'custom'`, `animated: true`
  2. 초기 데이터:
     - `step: 'STEP.'`
     - `stepValue: ''`
     - `showLabel: false`
     - `isConfirmed: false`
  3. Edge 핸들러:
     - `onStepChange`: `handleEdgeStepChange`
     - `onDelete`: `handleEdgeDelete`
     - `onSettingsClick`: source 노드의 설정 패널 열기
     - `onConfirm`: 그룹박스 확정 처리
     - `onEdit`: edge 편집 처리
  4. Edge 생성 후 100ms 후 `updateEdgeLabels` 호출하여 연결포인트 위치 보존
  5. Edge 생성 후 150ms 후 설정 패널 자동으로 열림

### 2.2 Edge 연결 시 노드 업데이트
- **위치**: `1424-1505` 라인
- **규칙**:
  1. Source 노드와 연결된 모든 노드를 재귀적으로 찾기
  2. Target 노드는 source 노드 그룹의 Y 좌표로 정렬
  3. Target 노드에 적용되는 값:
     - `hasConnectedEdge: true`
     - `step`: source 노드 그룹의 step 값
     - `stepValue`: source 노드 그룹의 stepValue 값
     - `isConfirmed: false` (신규 노드는 항상 확정 상태가 아님)
  4. 기존 그룹의 노드들은 `hasConnectedEdge: true`만 업데이트
  5. 기존 그룹에 신규 노드가 연결된 경우 설정 패널 자동으로 열림

### 2.3 Edge 삭제 (`handleEdgeDelete`)
- **위치**: `810-906` 라인
- **규칙**:
  1. Edge 삭제 시 연결된 노드 확인
  2. 노드에 다른 edge가 없으면:
     - `hasConnectedEdge: false`
     - `step: 'STEP.'`
     - `stepValue: ''`
     - `isConfirmed: false`
  3. 노드에 다른 edge가 있으면 `hasConnectedEdge: true` 유지
  4. Edge 삭제 후 `updateEdgeLabels` 호출하여 연결포인트 위치 보존 (`preserveConnectorPositions: true`)

---

## 3. 그룹박스 규칙

### 3.1 그룹박스 생성 및 관리 (`updateEdgeLabels`)
- **위치**: `50-672` 라인
- **규칙**:

#### 3.1.1 확정된 그룹박스 찾기
1. `groupConnector` 타입이고 `isConfirmed: true`인 노드 찾기
2. 그룹박스 타입 (`isGroupBox: true`):
   - `groupEdges`가 있는 경우
   - `groupId`는 `group-${connector.id}` 또는 저장된 값
   - 레벨은 저장된 값 또는 기본값 1
3. 단일 노드 타입 (`nodeId`가 있는 경우):
   - `groupId`는 `single-node-${nodeId}`
   - `edges: []` (단일 노드는 edge 없음)
   - `nodes: [nodeId]`
   - 레벨은 저장된 값 또는 기본값 1

#### 3.1.2 Edge 그룹화
1. 확정된 그룹박스의 edge는 제외하고 그룹화
2. 재귀적으로 연결된 모든 edge 찾기 (`findConnectedEdges`)
3. 확정된 그룹박스에 속한 노드를 만나면 `__group__${groupId}__` 형태로 표시
4. 확정된 그룹박스들도 `edgeGroups`에 추가 (독립적으로 관리)

#### 3.1.3 레벨 계산
1. **레벨 1**: 그룹과 신규 노드 또는 그룹과 다른 그룹이 연결되지 않은 경우
2. **레벨 2+**: 신규노드와 다른 그룹과 연결되어 새로운 그룹박스가 생성된 경우
   - 연결된 확정된 그룹박스들의 최대 레벨을 찾아서 +1

#### 3.1.4 연결포인트 생성
1. **확정된 그룹박스**:
   - 기존 연결포인트를 `confirmedGroups`의 `connectorId`로 찾기
   - 찾지 못하면 `currentNodes`에서 직접 찾기
   - 위치는 절대 변경하지 않음 (한번 계산된 위치는 유지)
   - 레벨은 변경하지 않음 (독립성 보장)
2. **새로운 그룹박스**:
   - 그룹의 X, Y 좌표 범위 계산
   - 라벨 위치 계산: `adjustedLabelY = maxY + 180`, `labelX = centerX + 90`
   - 연결포인트 ID는 `group-connector-${groupIndex}`
3. **단일 노드 연결포인트**:
   - 연결된 edge가 없는 확정된 노드만 처리
   - `confirmedGroups`에 포함된 노드는 제외
   - 기존 연결포인트가 있으면 위치 유지
   - 위치 계산: `labelX = node.position.x + 90`, `labelY = node.position.y + 200 + 60`

#### 3.1.5 showLabel 관리
1. **핵심 원칙**: 확정된 edge의 `showLabel: true`는 절대 변경하지 않음
2. 그룹 내에서 이미 `showLabel: true`인 모든 edge를 찾아서 유지
3. 확정된 edge 중 `showLabel: true`인 것이 있으면 그것만 유지
4. 그룹 내 확정된 노드가 있으면:
   - 확정된 edge 중 중앙에 가장 가까운 edge에 라벨 표시
5. 확정되지 않은 그룹은:
   - 중앙에 가장 가까운 edge에 라벨 표시

---

## 4. 확정(Confirm) 규칙

### 4.1 그룹박스 확정 (`handleNodeConfirm` - edgeId 있음)
- **위치**: `908-1092` 라인
- **규칙**:
  1. **유효성 검사**:
     - Edge가 존재해야 함
     - Edge의 `stepValue`가 비어있지 않아야 함
     - `processOrder`가 선택되어야 함 (`settingsDataRef.current` 사용)
     - `processSelection`이 선택되어야 함
  2. **확정 처리**:
     - Source 노드 기준으로 연결된 모든 노드와 edge 찾기 (재귀적)
     - 연결된 모든 edge를 `isConfirmed: true`로 변경
     - 연결된 모든 노드를 `isConfirmed: true`로 변경
     - 노드의 `draggable: false`로 설정
     - 노드의 `savedSettings`에 현재 설정 데이터 저장
  3. **연결포인트 생성**:
     - DOM에서 라벨박스 위치 구하기 (`data-edge-id` 속성 사용)
     - React Flow 좌표로 변환 (viewport transform 고려)
     - 연결포인트 노드 생성 (150ms 후 실행)
     - ID: `group-connector-${edgeId}`
     - 위치: 라벨박스 중앙 X, 라벨박스 상단 Y
     - `isConfirmed: true`, `isGroupBox: true`

### 4.2 단일 노드 확정 (`handleNodeConfirm` - nodeId만 있음)
- **위치**: `1093-1232` 라인
- **규칙**:
  1. **유효성 검사**:
     - 노드가 존재해야 함
     - 노드의 `stepValue`가 비어있지 않아야 함
     - `processOrder`가 선택되어야 함
     - `processSelection`이 선택되어야 함
  2. **확정 처리**:
     - 노드를 `isConfirmed: true`로 변경
     - 노드의 `draggable: false`로 설정
     - 노드의 `savedSettings`에 현재 설정 데이터 저장
  3. **연결포인트 생성**:
     - DOM에서 라벨박스 위치 구하기 (`data-node-id` 속성 사용)
     - React Flow 좌표로 변환
     - 연결포인트 노드 생성 (300ms 후 실행)
     - ID: `single-node-connector-${nodeId}`
     - 위치: 라벨박스 중앙 X, 라벨박스 상단 Y
     - `isConfirmed: true`, `isGroupBox: false`

### 4.3 확정 상태 관리
- **규칙**:
  1. 확정된 노드는 `draggable: false`
  2. 확정된 edge의 `showLabel: true`는 절대 변경하지 않음
  3. 확정된 그룹박스는 독립적으로 관리됨
  4. 확정된 그룹박스의 레벨은 변경하지 않음
  5. 확정된 그룹박스의 연결포인트 위치는 절대 변경하지 않음

---

## 5. 편집(Edit) 규칙

### 5.1 Edge 편집 (`handleEdgeEdit`)
- **위치**: `1236-1301` 라인
- **규칙**:
  1. **편집 범위**:
     - 해당 edge에 직접 연결된 노드만 찾기 (source와 target)
     - 확정된 그룹박스에 속한 노드는 편집 모드로 전환하지 않음 (그룹박스 간 독립성 유지)
     - 확정되지 않은 노드만 편집 모드로 전환
  2. **상태 변경**:
     - 편집 대상 노드: `draggable: true`, `isConfirmed: false`
     - 편집 대상 edge: `isConfirmed: false`, `showLabel`은 보존
  3. **연결포인트 업데이트**:
     - 100ms 후 `updateEdgeLabels` 호출 (`preserveConnectorPositions: true`)
     - 편집 모드이므로 `isConfirmed: false`인 연결포인트는 숨김 처리

### 5.2 노드 편집 (`handleNodeEdit`)
- **위치**: `1303-1368` 라인
- **규칙**:
  1. **편집 범위**:
     - 해당 노드와 연결된 모든 노드를 재귀적으로 찾기
     - 연결된 모든 노드를 편집 모드로 전환
  2. **상태 변경**:
     - 연결된 모든 노드: `draggable: true`, `isConfirmed: false`
     - 연결된 모든 edge: `isConfirmed: false`, `showLabel`은 보존
  3. **연결포인트 업데이트**:
     - 100ms 후 `updateEdgeLabels` 호출 (`preserveConnectorPositions: true`)
     - 편집 모드이므로 `isConfirmed: false`인 연결포인트는 숨김 처리

### 5.3 편집 모드에서의 연결포인트 처리
- **규칙**:
  1. 편집 모드에서는 연결포인트를 제거하지 않고 숨김 처리
  2. `GroupConnectorNode`에서 `data.isConfirmed`가 `false`이면 Handle을 렌더링하지 않음
  3. 확정 모드로 전환 시 기존 위치에서 다시 나타남
  4. 연결포인트 위치는 절대 재계산하지 않음

---

## 6. 그룹박스 독립성 규칙

### 6.1 그룹박스 간 독립성
- **규칙**:
  1. 각 그룹박스는 독립적으로 관리됨
  2. 한 그룹박스를 편집해도 다른 그룹박스는 영향받지 않음
  3. 확정된 그룹박스에 속한 노드는 다른 그룹박스 편집 시 편집 모드로 전환되지 않음
  4. 각 그룹박스의 연결포인트도 독립적으로 관리됨
  5. 한 그룹박스의 연결포인트 위치는 다른 그룹박스 상태에 간섭받지 않음

### 6.2 레벨 관리
- **규칙**:
  1. 레벨 1: 그룹과 신규 노드 또는 그룹과 다른 그룹이 연결되지 않은 경우
  2. 레벨 2+: 신규노드와 다른 그룹과 연결되어 새로운 그룹박스가 생성된 경우
  3. 확정된 그룹박스의 레벨은 변경하지 않음
  4. 새로운 그룹박스의 레벨은 연결된 확정된 그룹박스들의 최대 레벨 + 1

---

## 7. 연결포인트 위치 보존 규칙

### 7.1 위치 보존 원칙
- **규칙**:
  1. 한번 계산된 연결포인트 위치는 해당 라벨박스/그룹박스가 있는 한 유지되어야 함
  2. 확정된 그룹박스의 연결포인트는 위치를 절대 재계산하지 않음
  3. 기존 연결포인트를 찾으면 위치를 그대로 사용 (`position: existingConnector.position`)
  4. 확정된 그룹박스는 항상 기존 연결포인트를 찾아야 함
  5. 찾지 못하면 `currentNodes`에서 직접 찾기
  6. 단일 노드 연결포인트도 동일한 원칙 적용

### 7.2 위치 계산 규칙
- **그룹박스**:
  - `labelX = centerX + 90` (그룹 중앙 X + 노드 너비의 절반)
  - `adjustedLabelY = maxY + 180` (그룹 최대 Y + 180)
- **단일 노드**:
  - `labelX = node.position.x + 90` (노드 중앙)
  - `labelY = node.position.y + 200 + 60` (노드 하단 + 60px)

---

## 8. 설정 패널 규칙

### 8.1 설정 패널 열기 (`handleNodeSettingsClick`)
- **위치**: `733-808` 라인
- **규칙**:
  1. 선택된 노드와 연결된 모든 노드를 재귀적으로 찾기
  2. 연결된 노드들의 `savedSettings` 확인
  3. 그룹인 경우: 그룹의 모든 노드에서 `savedSettings` 찾기 (processOrder가 있는 경우만 유효)
  4. 단일 노드인 경우: 해당 노드의 `savedSettings` 확인
  5. 저장된 설정이 있으면 불러오기, 없으면 초기화
  6. 선택된 노드를 첫 번째로, 연결된 노드들을 뒤에 배치

### 8.2 설정 데이터 관리
- **규칙**:
  1. `settingsData`는 `useState`로 관리
  2. `settingsDataRef`를 사용하여 최신 상태 참조 (stale closure 방지)
  3. 확정 시 `savedSettings`에 현재 설정 데이터 저장
  4. 편집 시 저장된 설정 데이터 불러오기

---

## 9. 노드 삭제 규칙

### 9.1 노드 삭제 (`handleNodeDelete`)
- **위치**: `1554-1667` 라인
- **규칙**:
  1. 삭제되는 노드와 연결된 모든 edge 삭제
  2. 영향받은 노드들의 `hasConnectedEdge` 재계산
  3. Edge가 모두 제거되면:
     - `hasConnectedEdge: false`
     - `step: 'STEP.'`
     - `stepValue: ''`
     - `isConfirmed: false`
  4. 설정 패널 업데이트:
     - 삭제된 노드가 설정 패널에 있었다면 영향받은 노드 중 첫 번째로 갱신
     - 더 이상 연결된 노드가 없으면 설정 패널 닫기
  5. Edge 라벨 표시 업데이트 (`preserveConnectorPositions: true`)

---

## 10. 기타 규칙

### 10.1 상태 업데이트 순서
- **규칙**:
  1. `setNodes`와 `setEdges`는 비동기이므로 `setTimeout` 사용
  2. `updateEdgeLabels` 호출 전에 상태 업데이트 완료 대기 (100ms)
  3. DOM 조작은 `requestAnimationFrame`과 `setTimeout` 조합 사용

### 10.2 ID 생성 규칙
- **노드**: `node-${Date.now()}`
- **그룹 연결포인트**: `group-connector-${groupIndex}` 또는 `group-connector-${edgeId}`
- **단일 노드 연결포인트**: `single-node-connector-${nodeId}`
- **그룹 ID**: `group-${groupIndex}` 또는 `group-${edgeId}` 또는 `single-node-${nodeId}`

### 10.3 데이터 속성 규칙
- **노드**:
  - `isConfirmed`: 확정 여부
  - `hasConnectedEdge`: 연결된 edge 여부
  - `savedSettings`: 저장된 설정 데이터
  - `step`, `stepValue`: 스텝 정보
- **Edge**:
  - `isConfirmed`: 확정 여부
  - `showLabel`: 라벨 표시 여부
  - `step`, `stepValue`: 스텝 정보
- **연결포인트**:
  - `isConfirmed`: 확정 여부
  - `isGroupBox`: 그룹박스 여부
  - `nodeId`: 단일 노드 ID (단일 노드인 경우)
  - `groupId`: 그룹 ID
  - `groupEdges`: 그룹에 속한 edge ID 배열
  - `level`: 그룹 레벨
