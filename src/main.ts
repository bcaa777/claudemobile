import { Engine } from './engine/Engine'
import { loadSavedConfig, WORLD_CONFIG } from './config'

loadSavedConfig()

// New seed each session for a unique world every time
WORLD_CONFIG.seed = Date.now() % 1000000

const app = document.getElementById('app')
if (!app) throw new Error('No #app element found')

new Engine(app)
