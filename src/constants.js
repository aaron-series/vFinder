// 노드 크기 상수
export const NODE_WIDTH = 180
export const NODE_HEIGHT = 200

// 라벨박스 크기 상수
export const LABEL_BOX_WIDTH = 280
export const LABEL_BOX_HALF_WIDTH = LABEL_BOX_WIDTH / 2 // 140px
export const LABEL_BOX_HEIGHT = 250
export const LABEL_BOX_HALF_HEIGHT = LABEL_BOX_HEIGHT / 2 // 45px

// 라벨박스 오프셋
export const LABEL_BOX_OFFSET_Y = 60 // CSS: top: calc(100% + 60px)

// Category 코드와 이름 매핑
export const CATEGORY_MAP = {
  '01': "M'S SPORTSTYLE INNOVATION",
  '02': "W'S SPORTSTYLE INNOVATION",
  '03': "M'S RUNNING",
}

export const CATEGORY_MAP_BACKUP = {
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

// Gender 코드와 이름 매핑
export const GENDER_MAP = {
  '01': "M",
  '02': "W",
  '03': "GS",
  '04': "PS",
  '05': "TD",
  '06': "UNISEX"
}

export const PROCESS_SELECTION_MAP = {
  '01': "1 ROW STITCHING",
  '02': "2 ROW STITCHING",
  '03': "COMPUTER STITCHING",
  '04': "ZIGZAG STITCHING",
  '05': "SURGE STITCHING",
  '06': "OVERLOCK STITCHING",
  '07': "ARIANCE",
  '08': "GATHERING",
  '09': "STROBEL",
  '10': "HEAT SEAL",
  '11': "HAMMERING",
  '12': "TRIMMING",
  '13': "FOLDING",
  '14': "PUNCHING",
  '15': "COUNTER SHAPING",
  '16': "SHOE LACING",
  '17': "HOT MELT",
  '18': "STITCH & TURN",
  '19': "CLOSED SEAM STITCHING",
  '20': "TURN OVER",
  '21': "LIFT UP",
  '22': "PULL OUT",
  '23': "INSERT",
  '24': "PEEL OFF",
  '25': "ATTACH",
  '26': "TRIMMING",
  '27': "H/F WELDING",
  '28': "3D NO-SEW",
  '29': "FUSING",
  '30': "EYELETING"
}

export const MC_TYPE_MAP = {
  '01':  "1NEEDLE FLAT",
  '02': "1NEEDLE POST",
  '03': "2NEEDLE FLAT",
  '04': "2NEEDLE POST",
  '05': "ZIGZAG",
  '06': "3POINT ZIGZAG",
  '07': "SURGE",
  '08': "ARIANCE",
  '09': "GATHERING",
  '10': "STROBEL",
  '11': "BINDING",
  '12': "COMPUTER",
  '13': "OVERLOCK"
}

export const NEEDLE_TYPE_MAP = {
  '01': "DPX5",
  '02': "DPX17",
  '03': "DBX1",
  '04': "DCX27",
  '05': "UYX128GAX",
  '06': "DPX35LR",
  '07': "PFX134 PCL",
  '08': "SMX1014B",
  '09': "DBXK5",
  '10': "DPX8",
  '11': "CPX5",
  '12': "DCX1",
  '13': "DPX5 SAN 6"
}

export const NEEDLE_SIZE_MAP = {
  '01': "#9",
  '02': "#11",
  '03': "#14",
  '04': "#16",
  '05': "#18",
  '06': "#19",
  '07': "#21",
  '08': "#27",
}

export const NEEDLE_POINT_MAP = {
  '01': "R",
  '02': "DI",
  '03': "S",
  '04': "SD",
  '05': "P",
  '06': "D",
}

export const THREAD_TYPE_MAP = {
  '01': "N210D/3PLY",
  '02': "N210D/3PLY (COATS)",
  '03': "N210D/3PLY, M40 SILICON",
  '04': "N210D/3PLY, M40 SILICON (COATS)",
  '05': "N280D/3PLY",
  '06': "N280D/3PLY (COATS)",
  '07': "N280D/3PLY, M30 SILICON",
  '08': "N280D/3PLY, M30 SILICON (COATS)",
  '09': "N280D/3PLY (STITCH TO PP TAPE ) ",
  '10': "SPUN 30S/3PLY",
  '11': "SPUN 30S/3PLY (COATS)",
  '12': "SPUN 60S/2PLY",
  '13': "SPUN 60S/2PLY (COATS)",
  '14': "SPUN 60S/3PLY",
  '15': "SPUN 60S/3PLY (COATS)",
  '16': "P150D/3PLY",
  '17': "P150D/3PLY (COATS)",
  '18': "P150D/3PLY (RECYCLED)",
  '19': "P120D/2PLY",
  '20': "P120D/2PLY (COATS)",
  '21': "P120D/2PLY (RECYCLED)",
  '22': "P210D/3PLY (RECYCLED)",
  '23': "P200D/1PLY",
  '24': "P200D/1PLY (COATS)", 
  '25': "P200D/1PLY (RECYCLED)",
  '26': "P250D/3PLY",
  '27': "P250D/3PLY (COATS)",
  '28': "P250D/3PLY (RECYCLED)",
  '29': "#1~5:P150D/3PLY, #6:P200D/1PLY",
  '30': "#1~5:P150D/3PLY (COATS), #6:P200D/1PLY",
  '31':"#1~5:P150D/3PLY, #6:P200D/1PLY (COATS)",  
  '32':"#1~5:P150D/3PLY (COATS), #6:P200D/1PLY (COATS)",  
  '33':"#1~5:P150D/3PLY(RECYCLED), #6:P200D/1PLY",
  '34':"#1~5:P150D/3PLY, #6:P200D/1PLY(RECYCLED)",
  '35':"#1~5:P150D/3PLY(RECYCLED), #6:P200D/1PLY(RECYCLED)",
  '36':"#1~5:P120D/2PLY, #6:P200D/1PLY",
  '37':"#1~5:P120D/2PLY (COATS), #6:P200D/1PLY",
  '38':"#1~5:P120D/2PLY, #6:P200D/1PLY (COATS)",
  '39':"#1~5:P120D/2PLY (COATS), #6:P200D/1PLY (COATS)",
  '40':"#1~5:P120D/2PLY(RECYCLED), #6:P200D/1PLY",
  '41':"#1~5:P120D/2PLY, #6:P200D/1PLY(RECYCLED)",
  '42':"#1~5:P120D/2PLY(RECYCLED), #6:P200D/1PLY(RECYCLED)",
  '43':"1260D/3PLY(TOP), 840D/3PLY(BOTTOM)"
}

export const STITCHING_MARGIN_MAP = {
  '01': "0.5",
  '02': "1.5",
  '03': "1.8",
  '04': "2.5",
  '05': "3",
  '06': "1.5/1.5",
  '07': "1.5/2",
  '08': "2/2",
  '09': "3/3",
  '10': "2",
  '11': "4",
  '12': "10",
  '13': "2.5-3.0",
}

export const SPI_MAP = {
  '01': "7-8",
  '02': "7-9",
  '03': "9-10",
  '04': "10-11",
  '05': "11-12",
  '06': "8-9",
}

export const STITCHING_GUIDELINE_MAP = {
  '01': "S-SHORT(<20cm)",
  '02': "M-MEDIUM(20-40cm)",
  '03': "LS-LONG STRAIGHT(40-80cm)",
  '04': "LC-LONG CURVE(40-60cm)",
  '05': "ELC-EXTRA LONG CURVE(60-80cm)",
  '06': "CLOSED SEAM <=20cm",
  '07': "CLOSED SEAM >20cm",
}

export const STITCHING_LINES_MAP = {
  '01': "1",
  '02': "2",
  '03': "3",
  '04': "4",
  '05': "5",
  '06': "6",
  '07': "7",
  '08': "8",
  '09': "9",
  '10': "10",
}

export const STITCHING_GUIDE_MAP = {
  '01': "F1-001",
  '02': "F2-001",
  '03': "P1-001",
  '04': "P2-001",
  '05': "Z1-001",
  '06': "Z2-001",
  '07': "Z3-001",
  '08': "SG-001",
  '09': "BS-001",
  '10': "BZ-001",
  '11': "OL-001",
  '12': "G-001",
  '13': "ST-001",
  '14': "A1-001",
}

// Settings Process 초기 데이터
export const INITIAL_SETTINGS_DATA = {
  addedPartsIds: [],
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
  { value: '', label: 'Select a process...'},
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

// Process Selection 옵션 (PROCESS_SELECTION_MAP에서 변환)
export const PROCESS_SELECTION_OPTIONS = [
  { value: '', label: 'Select a process...' },
  ...Object.entries(PROCESS_SELECTION_MAP).map(([key, value]) => ({
    value: key,
    label: `${value}`
  }))
]

// MC Type 옵션
export const MC_TYPE_OPTIONS = [
  { value: '', label: 'Select an item...' },
  ...Object.entries(MC_TYPE_MAP).map(([key, value]) => ({
    value: key,
    label: `${value}`
  }))
]

// Needle Type 옵션
export const NEEDLE_TYPE_OPTIONS = [
  { value: '', label: 'Select an item...' },
  ...Object.entries(NEEDLE_TYPE_MAP).map(([key, value]) => ({
    value: key,
    label: `${value}`
  }))
]

// Needle Size 옵션
export const NEEDLE_SIZE_OPTIONS = [
  { value: '', label: 'Select an item...' },
  ...Object.entries(NEEDLE_SIZE_MAP).map(([key, value]) => ({
    value: key,
    label: `${value}`
  }))
]

// Needle Point 옵션
export const NEEDLE_POINT_OPTIONS = [
  { value: '', label: 'Select an item...' },
  ...Object.entries(NEEDLE_POINT_MAP).map(([key, value]) => ({
    value: key,
    label: `${value}`
  }))
]

// Thread Type 옵션
export const THREAD_TYPE_OPTIONS = [
  { value: '', label: 'Select an item...' },
  ...Object.entries(THREAD_TYPE_MAP).map(([key, value]) => ({
    value: key,
    label: `${value}`
  }))
]

// Stitching Margin 옵션
export const STITCHING_MARGIN_OPTIONS = [
  { value: '', label: 'Select an item...' },
  ...Object.entries(STITCHING_MARGIN_MAP).map(([key, value]) => ({
    value: key,
    label: `${value}`
  }))
]

// SPI 옵션
export const SPI_OPTIONS = [
  { value: '', label: 'Select an item...' },
  ...Object.entries(SPI_MAP).map(([key, value]) => ({
    value: key,
    label: `${value}`
  }))
]

// Stitching Guideline 옵션
export const STITCHING_GUIDELINE_OPTIONS = [
  { value: '', label: 'Select an item...' },
  ...Object.entries(STITCHING_GUIDELINE_MAP).map(([key, value]) => ({
    value: key,
    label: `${value}`
  }))
]

// Stitching Lines 옵션 (숫자 순서로 정렬)
export const STITCHING_LINES_OPTIONS = [
  { value: '', label: 'Select an item...' },
  ...Object.entries(STITCHING_LINES_MAP)
    .sort(([keyA], [keyB]) => parseInt(keyA) - parseInt(keyB))
    .map(([key, value]) => ({
      value: key,
      label: `${value}`
    }))
]

// Stitching Guide 옵션
export const STITCHING_GUIDE_OPTIONS = [
  { value: '', label: 'Select an item...' },
  ...Object.entries(STITCHING_GUIDE_MAP).map(([key, value]) => ({
    value: key,
    label: `${value}`
  }))
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
