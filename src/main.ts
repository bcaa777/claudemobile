import { Engine } from './engine/Engine'

const app = document.getElementById('app')
if (!app) throw new Error('No #app element found')

new Engine(app)
