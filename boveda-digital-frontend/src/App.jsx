import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [msg, setMsg] = useState('')

  useEffect(() => {
      fetch('/api/hola')      // <- gracias al proxy, va a http://localhost:8080/api/hola
        .then(r => r.text())
        .then(setMsg)
        .catch(() => setMsg('error al conectar con el backend'));
    }, []);

  return (
    <>
      <div>
        
        <div className="container">
          <h1 className="titulo">hola mundo, esta es mi bóveda</h1>
          <p className='springText'>{msg}</p>
        </div>

        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App