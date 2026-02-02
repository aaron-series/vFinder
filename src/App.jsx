import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import useRoutingStore from './store/useRoutingStore'
import { CATEGORY_MAP, GENDER_MAP } from './constants'
import logo from './assets/logo.png'
import nikeLogo from './assets/nike_logo.png'
import './App.css'

function App() {
  const navigate = useNavigate()

  // Zustand store 사용
  const {
    selectedFile,
    setSelectedFile,
    formData,
    setFormData,
    updateFormField,
    patterns,
    setPatterns,
    reorderPatterns,
    removePattern,
    showModal,
    setShowModal,
    isBasicInfoExpanded,
    setIsBasicInfoExpanded,
    isPatternPartsExpanded,
    setIsPatternPartsExpanded
  } = useRoutingStore()

  // 모달이 열릴 때마다 Model, Dev. Style, Category, Size 초기화
  useEffect(() => {
    if (showModal) {
      // fileName은 유지하고 나머지 필드만 초기화
      setFormData({
        fileName: formData.fileName || '',
        model: 'HO24 AIR MAX MUSE PROD 1209',
        devStyle: '',
        category: '',
        gender: ''
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal])

  // 드래그 앤 드롭 상태
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // 테이블 섹션 접기/펼치기 상태
  const [isTableSectionExpanded, setIsTableSectionExpanded] = useState(false)
  const [wasExpanded, setWasExpanded] = useState(true)

  // 입력 필드 ref
  const devStyleInputRef = useRef(null)
  const categorySelectRef = useRef(null)
  const genderSelectRef = useRef(null)

  const handleTableSectionToggle = () => {
    if (isTableSectionExpanded) {
      setWasExpanded(true)
    }
    setIsTableSectionExpanded(!isTableSectionExpanded)
    if (!isTableSectionExpanded) {
      setTimeout(() => {
        setWasExpanded(false)
      }, 500)
    }
  }

  // 패턴 테이블 드래그 앤 드롭 핸들러
  const handlePatternDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target.outerHTML)
    e.currentTarget.style.opacity = '0.5'
  }

  const handlePatternDragEnd = (e) => {
    e.currentTarget.style.opacity = '1'
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handlePatternDragOver = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handlePatternDragLeave = () => {
    setDragOverIndex(null)
  }

  const handlePatternDrop = (e, dropIndex) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null)
      return
    }

    // reorderPatterns 함수 사용
    reorderPatterns(draggedIndex, dropIndex)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setFormData({
        ...formData,
        fileName: file.name,
        model: 'HO24 AIR MAX MUSE PROD 1209'
      })

      // 로딩 시작
      setIsLoading(true)
      setLoadingProgress(0)

      // 2~4초 사이 랜덤 지연
      const delay = Math.random() * 2000 + 2000 // 2000ms ~ 4000ms
      const interval = 50 // 업데이트 간격 (ms)
      const steps = delay / interval // 총 스텝 수
      const increment = 100 / steps // 각 스텝당 증가량

      let currentProgress = 0
      const progressInterval = setInterval(() => {
        currentProgress += increment
        if (currentProgress >= 100) {
          setLoadingProgress(100)
          clearInterval(progressInterval)
        } else {
          setLoadingProgress(currentProgress)
        }
      }, interval)

      setTimeout(() => {
        clearInterval(progressInterval)
        setLoadingProgress(100)
        setIsLoading(false)
        setShowModal(true)
      }, delay)

      // input 값 초기화하여 같은 파일을 다시 선택할 수 있도록 함
      e.target.value = ''
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setSelectedFile(file)
      setFormData({
        ...formData,
        fileName: file.name,
        model: 'HO24 AIR MAX MUSE PROD 1209'
      })

      // 로딩 시작
      setIsLoading(true)
      setLoadingProgress(0)

      // 2~4초 사이 랜덤 지연
      const delay = Math.random() * 2000 + 2000 // 2000ms ~ 4000ms
      const interval = 50 // 업데이트 간격 (ms)
      const steps = delay / interval // 총 스텝 수
      const increment = 100 / steps // 각 스텝당 증가량

      let currentProgress = 0
      const progressInterval = setInterval(() => {
        currentProgress += increment
        if (currentProgress >= 100) {
          setLoadingProgress(100)
          clearInterval(progressInterval)
        } else {
          setLoadingProgress(currentProgress)
        }
      }, interval)

      setTimeout(() => {
        clearInterval(progressInterval)
        setLoadingProgress(100)
        setIsLoading(false)
        setShowModal(true)
      }, delay)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
  }

  const handleInputChange = (field, value) => {
    updateFormField(field, value)
  }

  const handlePatternRemove = async (e, patternId) => {
    e.stopPropagation()

    const pattern = patterns.find(p => p.id === patternId)
    const patternCode = pattern?.code || 'This pattern'

    const result = await Swal.fire({
      title: 'Remove Parts',
      html: `<u>${patternCode}</u> will be removed.<br/>Are you sure you want to remove it?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
      width: '440px',
      padding: '20px',
      customClass: {
        container: 'swal2-container-high-z'
      }
    })

    if (result.isConfirmed) {
      removePattern(patternId)
      Swal.fire({
        title: 'Remove Completed',
        text: 'Parts has been removed.',
        icon: 'success',
        confirmButtonColor: '#1f2937',
        width: '380px',
        padding: '20px',
        timer: 1000,
        showConfirmButton: false,
        customClass: {
          container: 'swal2-container-high-z'
        }
      })
    }
  }

  const handleGeneration = () => {
    // 유효성 검사: Dev. Style, Category, Gender 필수 항목 확인
    if (!formData.devStyle || formData.devStyle.trim() === '') {
      Swal.fire({
        title: 'Required',
        text: 'Please enter Dev. Style',
        icon: 'warning',
        confirmButtonColor: '#1f2937',
        width: '380px',
        padding: '20px',
        customClass: {
          container: 'swal2-container-high-z'
        }
      }).then(() => {
        // Basic Information 섹션이 접혀있으면 펼치기
        if (!isBasicInfoExpanded) {
          setIsBasicInfoExpanded(true)
          setTimeout(() => {
            devStyleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setTimeout(() => {
              devStyleInputRef.current?.focus()
              // 포커스 유지를 위해 추가 시도
              setTimeout(() => {
                devStyleInputRef.current?.focus()
              }, 50)
            }, 100)
          }, 300)
        } else {
          setTimeout(() => {
            devStyleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setTimeout(() => {
              devStyleInputRef.current?.focus()
              // 포커스 유지를 위해 추가 시도
              setTimeout(() => {
                devStyleInputRef.current?.focus()
              }, 50)
            }, 100)
          }, 100)
        }
      })
      return
    }

    if (!formData.category || formData.category.trim() === '') {
      Swal.fire({
        title: 'Required',
        text: 'Please select Category',
        icon: 'warning',
        confirmButtonColor: '#1f2937',
        width: '380px',
        padding: '20px',
        customClass: {
          container: 'swal2-container-high-z'
        }
      }).then(() => {
        // Basic Information 섹션이 접혀있으면 펼치기
        if (!isBasicInfoExpanded) {
          setIsBasicInfoExpanded(true)
          setTimeout(() => {
            categorySelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setTimeout(() => {
              categorySelectRef.current?.focus()
              // 포커스 유지를 위해 추가 시도
              setTimeout(() => {
                categorySelectRef.current?.focus()
              }, 50)
            }, 100)
          }, 300)
        } else {
          setTimeout(() => {
            categorySelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setTimeout(() => {
              categorySelectRef.current?.focus()
              // 포커스 유지를 위해 추가 시도
              setTimeout(() => {
                categorySelectRef.current?.focus()
              }, 50)
            }, 100)
          }, 100)
        }
      })
      return
    }

    if (!formData.gender || formData.gender.trim() === '') {
      Swal.fire({
        title: 'Required',
        text: 'Please select Gender',
        icon: 'warning',
        confirmButtonColor: '#1f2937',
        width: '380px',
        padding: '20px',
        customClass: {
          container: 'swal2-container-high-z'
        }
      }).then(() => {
        // Basic Information 섹션이 접혀있으면 펼치기
        if (!isBasicInfoExpanded) {
          setIsBasicInfoExpanded(true)
          setTimeout(() => {
            genderSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setTimeout(() => {
              genderSelectRef.current?.focus()
              // 포커스 유지를 위해 추가 시도
              setTimeout(() => {
                genderSelectRef.current?.focus()
              }, 50)
            }, 100)
          }, 300)
        } else {
          setTimeout(() => {
            genderSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setTimeout(() => {
              genderSelectRef.current?.focus()
              // 포커스 유지를 위해 추가 시도
              setTimeout(() => {
                genderSelectRef.current?.focus()
              }, 50)
            }, 100)
          }, 100)
        }
      })
      return
    }

    // formData를 store에 저장 (새로고침 후에도 유지되도록)
    setFormData({
      fileName: formData.fileName || '',
      model: formData.model || '',
      devStyle: formData.devStyle || '',
      category: formData.category || '',
      gender: formData.gender || '',
    })
    // 에디터 페이지로 이동 (zustand로 상태 공유)
    navigate('/editor')
  }

  // 샘플 데이터
  const routingData = [
    {
      id: 1,
      image: '/placeholder-shoe.png',
      model: 'Nike Air Max 90',
      devStyle: 'DH2973',
      category: 'DH2973',
      gender: 'M',
      patterns: '25',
      lastUpdate: '2026.01.07 11:30 40:12'
    },
    {
      id: 2,
      image: '/placeholder-shoe.png',
      model: 'Nike Air Max 90',
      devStyle: 'DH2973',
      category: 'DH2973',
      gender: 'M',
      patterns: '25',
      lastUpdate: '2026.01.07 11:30 40:12'
    },
    {
      id: 3,
      image: '/placeholder-shoe.png',
      model: 'Nike Air Max 90',
      devStyle: 'DH2973',
      category: 'DH2973',
      gender: 'M',
      patterns: '25',
      lastUpdate: '2026.01.07 11:30 40:12'
    },
    {
      id: 4,
      image: '/placeholder-shoe.png',
      model: 'Nike Air Max 90',
      devStyle: 'DH2973',
      category: 'DH2973',
      gender: 'M',
      patterns: '25',
      lastUpdate: '2026.01.07 11:30 40:12'
    }
  ]

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <img src={logo} alt="CSG Logo" className="logo" />
          <h1 className="title">ROUTING TREE</h1>
        </div>
        <div className="header-right">
          <img src={nikeLogo} alt="Profile" className="profile-icon" />
        </div>
      </header>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p className="loading-text">Processing file...</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${loadingProgress}%` }}></div>
            </div>
            <p className="progress-text">{Math.round(loadingProgress)}%</p>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Routing Tree Generation Settings</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <div className="modal-body">
              {/* 기본 정보 섹션 */}
              <div className="section">
                <div className="section-header" onClick={() => setIsBasicInfoExpanded(!isBasicInfoExpanded)}>
                  <h3 className="section-title">Basic Information</h3>
                  <span className={`section-toggle ${isBasicInfoExpanded ? 'expanded' : ''}`}>^</span>
                </div>

                {isBasicInfoExpanded && (
                  <div className="section-content">
                    {/* 업로드한 파일 */}
                    <div className="form-group full-width">
                      <label className="form-label">Uploaded File</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.fileName}
                        readOnly
                      />
                    </div>

                    {/* Model & Dev. Style */}
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Model*</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formData.model}
                          onChange={(e) => handleInputChange('model', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Dev. Style*</label>
                        <input
                          ref={devStyleInputRef}
                          type="text"
                          className="form-input"
                          placeholder="Enter Dev. Style"
                          value={formData.devStyle}
                          onChange={(e) => handleInputChange('devStyle', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Category & Gender */}
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Category*</label>
                        <select
                          ref={categorySelectRef}
                          className="form-select"
                          value={formData.category}
                          onChange={(e) => handleInputChange('category', e.target.value)}
                        >
                          <option value="">Select Category</option>
                          {Object.entries(CATEGORY_MAP).map(([key, value]) => (
                            <option key={key} value={key}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Gender*</label>
                        <select
                          ref={genderSelectRef}
                          className="form-select"
                          value={formData.gender}
                          onChange={(e) => handleInputChange('gender', e.target.value)}
                        >
                          <option value="">Select Gender</option>
                          {Object.entries(GENDER_MAP).map(([key, value]) => (
                            <option key={key} value={key}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pattern Parts Section */}
              <div className="section">
                <div className="section-header" onClick={() => setIsPatternPartsExpanded(!isPatternPartsExpanded)}>
                  <h3 className="section-title">Pattern Parts</h3>
                  <span className={`section-toggle ${isPatternPartsExpanded ? 'expanded' : ''}`}>^</span>
                </div>

                {isPatternPartsExpanded && (
                  <div className="section-content">
                    <div className="pattern-table">
                      <div className="pattern-table-header">
                        <div className="pattern-col pattern-col-drag"></div>
                        <div className="pattern-col pattern-col-no">no.</div>
                        <div className="pattern-col pattern-col-thumbnail"></div>
                        <div className="pattern-col pattern-col-code">Pattern Code</div>
                        <div className="pattern-col pattern-col-layer">Original Layer Name</div>
                        <div className="pattern-col pattern-col-menu"></div>
                      </div>

                      <div className="pattern-table-body">
                        {patterns.map((pattern, index) => (
                          <div
                            key={pattern.id}
                            className={`pattern-row ${dragOverIndex === index ? 'drag-over' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
                            draggable
                            onDragStart={(e) => handlePatternDragStart(e, index)}
                            onDragEnd={handlePatternDragEnd}
                            onDragOver={(e) => handlePatternDragOver(e, index)}
                            onDragLeave={handlePatternDragLeave}
                            onDrop={(e) => handlePatternDrop(e, index)}
                          >
                            <div className="pattern-col pattern-col-drag">
                              <span className="drag-handle" draggable={false}>☰</span>
                            </div>
                            <div className="pattern-col pattern-col-no">{pattern.no}</div>
                            <div className="pattern-col pattern-col-thumbnail">
                              <div className="pattern-thumbnail">
                                {pattern.thumbnail ? (
                                  <img src={pattern.thumbnail} alt={pattern.code} className="pattern-thumbnail-image" />
                                ) : (
                                  <svg width="100%" height="100%" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M30 60 L60 30 L90 60 L60 90 Z" stroke="#999" strokeWidth="2" fill="none" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <div className="pattern-col pattern-col-code">
                              <input
                                type="text"
                                className="pattern-input"
                                value={pattern.code}
                                onChange={(e) => {
                                  const newPatterns = patterns.map(p =>
                                    p.id === pattern.id ? { ...p, code: e.target.value } : p
                                  )
                                  setPatterns(newPatterns)
                                }}
                              />
                            </div>
                            <div className="pattern-col pattern-col-layer">
                              <span className="layer-name">{pattern.layerName}</span>
                            </div>
                            <div className="pattern-col pattern-col-menu">
                              <button
                                className="pattern-menu-btn"
                                onClick={(e) => handlePatternRemove(e, pattern.id)}
                                title="제거"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button className="btn-generation" onClick={handleGeneration}>
                Generation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        {/* Upload Section */}
        <section className="upload-section">
          <h2 className="upload-title">
            {'ROUTING TREE GENERATION'.split('').map((char, index) => (
              <span 
                key={index} 
                className="char" 
                data-char={char === ' ' ? '\u00A0' : char}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </h2>

          <div
            className="upload-box"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <svg className="animated-border">
              <rect x="2" y="2" rx="20" ry="20" />
            </svg>

            <svg className="upload-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 16V7.85L8.4 10.45L7 9L12 4L17 9L15.6 10.45L13 7.85V16H11ZM6 20C5.45 20 4.979 19.804 4.587 19.412C4.195 19.02 3.99934 18.5493 4 18V15H6V18H18V15H20V18C20 18.55 19.804 19.021 19.412 19.413C19.02 19.805 18.5493 20.0007 18 20H6Z" fill="#4A90E2" />
            </svg>
            <p className="upload-text">Drag and drop your file or click to attach</p>
          </div>
          <input
            type="file"
            id="fileInput"
            accept=".dxf"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          <p className="upload-subtitle">Upload your pattern file.*.dxf extension only supported</p> {/* Upload your pattern file.*.dxf extension only supported */}
        </section>

        {/* Table Section */}
        <section className={`table-section ${isTableSectionExpanded ? 'expanded' : 'collapsed'} ${wasExpanded && !isTableSectionExpanded ? 'collapsing' : !wasExpanded && isTableSectionExpanded ? 'expanding' : ''}`}>
          <button
            className="table-toggle-btn"
            onClick={handleTableSectionToggle}
            aria-label={isTableSectionExpanded ? 'Collapse table' : 'Expand table'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="table-header">
            <h2 className="table-title">Routing Tree List</h2>
            <div className="table-filters">
              <select className="filter-select">
                <option>Latest</option>
                <option>Oldest</option>
              </select>
              <select className="filter-select">
                <option>Category</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Model</th>
                  <th>Dev. Style</th>
                  <th>Category</th>
                  <th>Gender</th>
                  <th>Patterns</th>
                  <th>Last Update</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {routingData.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="product-image"></div>
                    </td>
                    <td className="model-name">{item.model}</td>
                    <td>{item.devStyle}</td>
                    <td>{item.category}</td>
                    <td>{item.gender}</td>
                    <td>{item.patterns}</td>
                    <td>{item.lastUpdate}</td>
                    <td>
                      <button className="menu-button">⋮</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
