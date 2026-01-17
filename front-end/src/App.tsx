import { Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { Home } from './pages/Home'
import './App.css'

function App() {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
