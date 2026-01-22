import { Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { Home } from './pages/Home'
import { About } from './pages/About'
import { Documentation } from './pages/Documentation'
import { HowToUse } from './pages/HowToUse'
import { DatabaseDetail } from './pages/DatabaseDetail'
import { TableDetail } from './pages/TableDetail'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/databases/:name" element={<DatabaseDetail />} />
      <Route path="/databases/:dbName/tables/:tableName" element={<TableDetail />} />
      <Route
        path="/*"
        element={
          <div className="h-screen flex flex-col">
            <Header />
            <main className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/documentation" element={<Documentation />} />
                <Route path="/how-to-use" element={<HowToUse />} />
              </Routes>
            </main>
          </div>
        }
      />
    </Routes>
  )
}

export default App
