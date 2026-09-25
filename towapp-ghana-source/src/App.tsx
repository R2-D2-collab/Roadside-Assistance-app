import { BrowserRouter, Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import CustomerRequest from './pages/CustomerRequest'
import OperatorDashboard from './pages/OperatorDashboard'
import AdminDashboard from './pages/AdminDashboard'

function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <main className="pb-16">
        <Routes>
          <Route path="/" element={<CustomerRequest />} />
          <Route path="/operator" element={<OperatorDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
