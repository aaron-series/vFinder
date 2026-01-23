// 노드 크기 상수
export const NODE_WIDTH = 180
export const NODE_HEIGHT = 200

// 라벨박스 크기 상수
export const LABEL_BOX_WIDTH = 280
export const LABEL_BOX_HALF_WIDTH = LABEL_BOX_WIDTH / 2 // 140px
export const LABEL_BOX_HEIGHT = 90
export const LABEL_BOX_HALF_HEIGHT = LABEL_BOX_HEIGHT / 2 // 45px

// 라벨박스 오프셋
export const LABEL_BOX_OFFSET_Y = 60 // CSS: top: calc(100% + 60px)

// Category 코드와 이름 매핑
export const CATEGORY_MAP = {
  'A': "Men's Court",
  'B': "Women's Court",
  'C': 'Causal',
  'D': "Men's Running",
  'E': "Women's Running",
  'F': "Men's Fitness",
  'G': 'Cleated',
  'H': 'Outdoor',
  'L': 'Military Special Forces',
  'MR': "Men's Performance/Running",
  'MT': "Men's Training",
  'N': "Men's Specialty",
  'P': "Women's Specialty",
  'R': "Men's Track & Field",
  'S': 'Sandals',
  'WT': "Women's Training",
  'YA': 'Young Athletes',
  'NSW': 'Nike Sports Wear',
  'NST': 'Nike Sports Training',
  'AS': 'Action Sports',
  'BB': 'Basketball',
  'JM': "Jordan Men's",
  'GF': 'Global Soccer',
  'GFK': 'Global Soccer Kids',
  'IF': 'Infants',
  'NA': 'Native American'
}

// Settings Process 초기 데이터
export const INITIAL_SETTINGS_DATA = {
  processOrder: '',
  processSelection: '',
  mcType: '',
  needleType: '',
  needleSize: '',
  needlePoint: '',
  threadType: '',
  stitchingMargin: '',
  spi: '',
  stitchingGuideline: '',
  stitchingLines: '',
  stitchingGuide: '',
  bol: '',
  hash: ''
}

// Process Order 옵션
export const PROCESS_ORDER_OPTIONS = [
  { value: '', label: 'Select a process...', disabled: true },
  { value: 'STEP 01', label: 'STEP 01' },
  { value: 'STEP 02', label: 'STEP 02' },
  { value: 'STEP 03', label: 'STEP 03' },
  { value: 'STEP 04', label: 'STEP 04' },
  { value: 'STEP 05', label: 'STEP 05' },
  { value: 'STEP 06', label: 'STEP 06' },
  { value: 'STEP 07', label: 'STEP 07' },
  { value: 'STEP 08', label: 'STEP 08' },
  { value: 'STEP 09', label: 'STEP 09' },
  { value: 'STEP 10', label: 'STEP 10' }
]

// Process Selection 옵션
export const PROCESS_SELECTION_OPTIONS = [
  { value: '', label: 'Select a process...', disabled: true },
  { value: 'stitching', label: 'Stitching' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'pressing', label: 'Pressing' }
]

// Detail Items 설정
export const DETAIL_ITEMS = [
  { key: 'mcType', label: 'MC Type' },
  { key: 'needleType', label: 'Needle Type' },
  { key: 'needleSize', label: 'Needle Size' },
  { key: 'needlePoint', label: 'Needle Point' },
  { key: 'threadType', label: 'Thread Type' },
  { key: 'stitchingMargin', label: 'Stitching Margin' },
  { key: 'spi', label: 'SPI' },
  { key: 'stitchingGuideline', label: 'Stitching Guideline' },
  { key: 'stitchingLines', label: 'Stitching Lines' },
  { key: 'stitchingGuide', label: 'Stitching Guide' },
  { key: 'bol', label: 'BOL' },
  { key: 'hash', label: '#' }
]
