import { useEffect, useState } from 'react'

type Player = {
  name: string
  team: string
  position: string
}

function App() {
  const [players, setPlayers] = useState<Player[]>([])

  useEffect(() => {
    fetch('http://localhost:8000/players')
      .then(res => res.json())
      .then(data => setPlayers(data))
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6">
        <h1 className="text-3xl font-bold text-blue-600 mb-6">Player List</h1>
        <ul className="space-y-4">
          {players.map((p, idx) => (
            <li
              key={idx}
              className="p-4 border rounded-lg bg-blue-50 hover:bg-blue-100 transition"
            >
              <div className="text-lg font-medium">{p.name}</div>
              <div className="text-sm text-gray-700">
                {p.position} — {p.team}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default App
