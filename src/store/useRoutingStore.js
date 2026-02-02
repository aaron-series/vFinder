import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useRoutingStore = create(
  persist(
    (set) => ({
      // 파일 정보
      selectedFile: null,
      setSelectedFile: (file) => set({ selectedFile: file }),

      // 폼 데이터
      formData: {
        fileName: '',
        model: '',
        devStyle: '',
        category: '',
        gender: '',
      },
      setFormData: (data) => set({ formData: data }),
      updateFormField: (field, value) => set((state) => ({
        formData: { ...state.formData, [field]: value }
      })),

  // 패턴 데이터
  patterns: [
    { id: 1, no: '01', code: 'AIR_MAX_MUSE_FV1920-7', layerName: 'AIR_MAX_MUSE_FV1920-7', thumbnail: '/parts/AIR_MAX_MUSE_FV1920-7.png' },
    { id: 2, no: '02', code: 'PT017Q070', layerName: 'PT017Q070', thumbnail: '/parts/PT017Q070.png' },
    { id: 3, no: '03', code: 'U0084_COLLAR_FOAM-7', layerName: 'U0084_COLLAR_FOAM-7', thumbnail: '/parts/U0084_COLLAR_FOAM-7.png' },
    { id: 4, no: '04', code: 'U0086_COLLAR_FOAM_1-7', layerName: 'U0086_COLLAR_FOAM_1-7', thumbnail: '/parts/U0086_COLLAR_FOAM_1-7.png' },
    { id: 5, no: '05', code: 'U0091_NEW_U0091_COLL-7', layerName: 'U0091_NEW_U0091_COLL-7', thumbnail: '/parts/U0091_NEW_U0091_COLL-7.png' },
    { id: 6, no: '06', code: 'U0136_COUNTER-7', layerName: 'U0136_COUNTER-7', thumbnail: '/parts/U0136_COUNTER-7.png' },
    { id: 7, no: '07', code: 'U0189_EYESTAY_FACING-7', layerName: 'U0189_EYESTAY_FACING-7', thumbnail: '/parts/U0189_EYESTAY_FACING-7.png' },
    { id: 8, no: '08', code: 'U0261_EYESTAY_WEBBIN-7', layerName: 'U0261_EYESTAY_WEBBIN-7', thumbnail: '/parts/U0261_EYESTAY_WEBBIN-7.png' },
    { id: 9, no: '09', code: 'U0684_TIP_ULAY_GR1-7', layerName: 'U0684_TIP_ULAY_GR1-7', thumbnail: '/parts/U0684_TIP_ULAY_GR1-7.png' },
    { id: 10, no: '10', code: 'U0686_TIP_ULAY_REINF-7', layerName: 'U0686_TIP_ULAY_REINF-7', thumbnail: '/parts/U0686_TIP_ULAY_REINF-7.png' },
    { id: 11, no: '11', code: 'U0703_TONGUE-7', layerName: 'U0703_TONGUE-7', thumbnail: '/parts/U0703_TONGUE-7.png' },
    { id: 12, no: '12', code: 'U0712_TONGUE_FOAM-7', layerName: 'U0712_TONGUE_FOAM-7', thumbnail: '/parts/U0712_TONGUE_FOAM-7.png' },
    { id: 13, no: '13', code: 'U0727_TONGUE_LINING-7', layerName: 'U0727_TONGUE_LINING-7', thumbnail: '/parts/U0727_TONGUE_LINING-7.png' },
    { id: 14, no: '14', code: 'U0757_TONGUE_TOP-7', layerName: 'U0757_TONGUE_TOP-7', thumbnail: '/parts/U0757_TONGUE_TOP-7.png' },
    { id: 15, no: '15', code: 'U0865_VAMP_QUARTER_B-7', layerName: 'U0865_VAMP_QUARTER_B-7', thumbnail: '/parts/U0865_VAMP_QUARTER_B-7.png' },
    { id: 16, no: '16', code: 'U5479_TONGUE_BOTTOM-7', layerName: 'U5479_TONGUE_BOTTOM-7', thumbnail: '/parts/U5479_TONGUE_BOTTOM-7.png' },
    { id: 17, no: '17', code: 'U5784_COLLAR_MEDIAL_-7', layerName: 'U5784_COLLAR_MEDIAL_-7', thumbnail: '/parts/U5784_COLLAR_MEDIAL_-7.png' },
    { id: 18, no: '18', code: 'U7474_COLLAR_LATERAL-7', layerName: 'U7474_COLLAR_LATERAL-7', thumbnail: '/parts/U7474_COLLAR_LATERAL-7.png' },
    { id: 19, no: '19', code: 'U8028_TIP_BOTTOM_RF_-7', layerName: 'U8028_TIP_BOTTOM_RF_-7', thumbnail: '/parts/U8028_TIP_BOTTOM_RF_-7.png' },
    { id: 20, no: '20', code: 'U8029_TIP_BOTTOM_RF_-7', layerName: 'U8029_TIP_BOTTOM_RF_-7', thumbnail: '/parts/U8029_TIP_BOTTOM_RF_-7.png' },
    { id: 21, no: '21', code: 'U8324_QUATER_OLAY_RF-7', layerName: 'U8324_QUATER_OLAY_RF-7', thumbnail: '/parts/U8324_QUATER_OLAY_RF-7.png' },
    { id: 22, no: '22', code: 'U8330_QTR_OLAY_RF_ME-7', layerName: 'U8330_QTR_OLAY_RF_ME-7', thumbnail: '/parts/U8330_QTR_OLAY_RF_ME-7.png' },
    { id: 23, no: '23', code: 'U8448_TIP_ULAY_LATER-7', layerName: 'U8448_TIP_ULAY_LATER-7', thumbnail: '/parts/U8448_TIP_ULAY_LATER-7.png' },
    { id: 24, no: '24', code: 'U8449_TIP_ULAY_MEDIA-7', layerName: 'U8449_TIP_ULAY_MEDIA-7', thumbnail: '/parts/U8449_TIP_ULAY_MEDIA-7.png' }
  ],
  setPatterns: (patterns) => set({ patterns }),
  updatePattern: (id, updates) => set((state) => ({
    patterns: state.patterns.map(p => 
      p.id === id ? { ...p, ...updates } : p
    )
  })),
  reorderPatterns: (fromIndex, toIndex) => set((state) => {
    const newPatterns = [...state.patterns]
    const [removed] = newPatterns.splice(fromIndex, 1)
    newPatterns.splice(toIndex, 0, removed)
    // no 값도 업데이트
    const updatedPatterns = newPatterns.map((p, index) => ({
      ...p,
      no: String(index + 1).padStart(2, '0')
    }))
    return { patterns: updatedPatterns }
  }),
  removePattern: (id) => set((state) => {
    const filteredPatterns = state.patterns.filter(p => p.id !== id)
    // no 값도 업데이트
    const updatedPatterns = filteredPatterns.map((p, index) => ({
      ...p,
      no: String(index + 1).padStart(2, '0')
    }))
    return { patterns: updatedPatterns }
  }),

  // 모달 상태
  showModal: false,
  setShowModal: (show) => set({ showModal: show }),

  // 기본 정보 섹션 확장 상태
  isBasicInfoExpanded: true,
  setIsBasicInfoExpanded: (expanded) => set({ isBasicInfoExpanded: expanded }),

  // 패턴 파츠 섹션 확장 상태
  isPatternPartsExpanded: true,
  setIsPatternPartsExpanded: (expanded) => set({ isPatternPartsExpanded: expanded }),

      // 초기화
      reset: () => set({
        selectedFile: null,
        formData: {
          fileName: '',
          model: '',
          devStyle: '',
          category: '',
          gender: '',
        },
        patterns: [
          { id: 1, no: '01', code: 'AIR_MAX_MUSE_FV1920-7', layerName: 'AIR_MAX_MUSE_FV1920-7', thumbnail: '/parts/AIR_MAX_MUSE_FV1920-7.png' },
          { id: 2, no: '02', code: 'PT017Q070', layerName: 'PT017Q070', thumbnail: '/parts/PT017Q070.png' },
          { id: 3, no: '03', code: 'U0084_COLLAR_FOAM-7', layerName: 'U0084_COLLAR_FOAM-7', thumbnail: '/parts/U0084_COLLAR_FOAM-7.png' },
          { id: 4, no: '04', code: 'U0086_COLLAR_FOAM_1-7', layerName: 'U0086_COLLAR_FOAM_1-7', thumbnail: '/parts/U0086_COLLAR_FOAM_1-7.png' },
          { id: 5, no: '05', code: 'U0091_NEW_U0091_COLL-7', layerName: 'U0091_NEW_U0091_COLL-7', thumbnail: '/parts/U0091_NEW_U0091_COLL-7.png' },
          { id: 6, no: '06', code: 'U0136_COUNTER-7', layerName: 'U0136_COUNTER-7', thumbnail: '/parts/U0136_COUNTER-7.png' },
          { id: 7, no: '07', code: 'U0189_EYESTAY_FACING-7', layerName: 'U0189_EYESTAY_FACING-7', thumbnail: '/parts/U0189_EYESTAY_FACING-7.png' },
          { id: 8, no: '08', code: 'U0261_EYESTAY_WEBBIN-7', layerName: 'U0261_EYESTAY_WEBBIN-7', thumbnail: '/parts/U0261_EYESTAY_WEBBIN-7.png' },
          { id: 9, no: '09', code: 'U0684_TIP_ULAY_GR1-7', layerName: 'U0684_TIP_ULAY_GR1-7', thumbnail: '/parts/U0684_TIP_ULAY_GR1-7.png' },
          { id: 10, no: '10', code: 'U0686_TIP_ULAY_REINF-7', layerName: 'U0686_TIP_ULAY_REINF-7', thumbnail: '/parts/U0686_TIP_ULAY_REINF-7.png' },
          { id: 11, no: '11', code: 'U0703_TONGUE-7', layerName: 'U0703_TONGUE-7', thumbnail: '/parts/U0703_TONGUE-7.png' },
          { id: 12, no: '12', code: 'U0712_TONGUE_FOAM-7', layerName: 'U0712_TONGUE_FOAM-7', thumbnail: '/parts/U0712_TONGUE_FOAM-7.png' },
          { id: 13, no: '13', code: 'U0727_TONGUE_LINING-7', layerName: 'U0727_TONGUE_LINING-7', thumbnail: '/parts/U0727_TONGUE_LINING-7.png' },
          { id: 14, no: '14', code: 'U0757_TONGUE_TOP-7', layerName: 'U0757_TONGUE_TOP-7', thumbnail: '/parts/U0757_TONGUE_TOP-7.png' },
          { id: 15, no: '15', code: 'U0865_VAMP_QUARTER_B-7', layerName: 'U0865_VAMP_QUARTER_B-7', thumbnail: '/parts/U0865_VAMP_QUARTER_B-7.png' },
          { id: 16, no: '16', code: 'U5479_TONGUE_BOTTOM-7', layerName: 'U5479_TONGUE_BOTTOM-7', thumbnail: '/parts/U5479_TONGUE_BOTTOM-7.png' },
          { id: 17, no: '17', code: 'U5784_COLLAR_MEDIAL_-7', layerName: 'U5784_COLLAR_MEDIAL_-7', thumbnail: '/parts/U5784_COLLAR_MEDIAL_-7.png' },
          { id: 18, no: '18', code: 'U7474_COLLAR_LATERAL-7', layerName: 'U7474_COLLAR_LATERAL-7', thumbnail: '/parts/U7474_COLLAR_LATERAL-7.png' },
          { id: 19, no: '19', code: 'U8028_TIP_BOTTOM_RF_-7', layerName: 'U8028_TIP_BOTTOM_RF_-7', thumbnail: '/parts/U8028_TIP_BOTTOM_RF_-7.png' },
          { id: 20, no: '20', code: 'U8029_TIP_BOTTOM_RF_-7', layerName: 'U8029_TIP_BOTTOM_RF_-7', thumbnail: '/parts/U8029_TIP_BOTTOM_RF_-7.png' },
          { id: 21, no: '21', code: 'U8324_QUATER_OLAY_RF-7', layerName: 'U8324_QUATER_OLAY_RF-7', thumbnail: '/parts/U8324_QUATER_OLAY_RF-7.png' },
          { id: 22, no: '22', code: 'U8330_QTR_OLAY_RF_ME-7', layerName: 'U8330_QTR_OLAY_RF_ME-7', thumbnail: '/parts/U8330_QTR_OLAY_RF_ME-7.png' },
          { id: 23, no: '23', code: 'U8448_TIP_ULAY_LATER-7', layerName: 'U8448_TIP_ULAY_LATER-7', thumbnail: '/parts/U8448_TIP_ULAY_LATER-7.png' },
          { id: 24, no: '24', code: 'U8449_TIP_ULAY_MEDIA-7', layerName: 'U8449_TIP_ULAY_MEDIA-7', thumbnail: '/parts/U8449_TIP_ULAY_MEDIA-7.png' }
        ],
        showModal: false,
        isBasicInfoExpanded: true,
        isPatternPartsExpanded: true
      })
    }),
    {
      name: 'routing-tree-storage',
      partialize: (state) => ({
        formData: state.formData
      })
    }
  )
)

export default useRoutingStore
