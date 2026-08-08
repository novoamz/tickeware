import { createApp } from 'vue'
import './index.css'
import App from './App.vue'

const root = document.getElementById('root')
if (!root) {
  console.error('Mount target #root not found')
} else {
  createApp(App).mount(root)
}
