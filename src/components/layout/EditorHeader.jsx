import logo from '../../assets/logo.png'
import nikeLogo from '../../assets/nike_logo.png'

const EditorHeader = () => {
  return (
    <header className="editor-header">
      <div className="editor-header-left">
        <img 
          src={logo} 
          alt="CSG Logo" 
          className="logo" 
        />
        <h1 className="title">ROUTING TREE</h1>
      </div>
      <div className="editor-header-right">
        <img src={nikeLogo} alt="Profile" className="profile-icon" />
      </div>
    </header>
  )
}

export default EditorHeader
