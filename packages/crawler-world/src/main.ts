import { Game } from './Game'

const app = document.getElementById('app')
if (!app) throw new Error('No #app element found')

new Game(app)
