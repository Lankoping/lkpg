import { getRouter } from './router'
import { StartServer } from '@tanstack/react-start/server'

export default function App() {
  return <StartServer router={getRouter()} />
}
