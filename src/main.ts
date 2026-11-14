import projectIndex from './data/projects.json'
import { startHorses } from './scene/horse-scene'

const list = document.querySelector('#project-list')!
for (const project of projectIndex.projects) {
  const entry = document.createElement('details')
  entry.id = 'project-' + project.id
  const heading = document.createElement('summary')
  heading.className = 'project-title'
  heading.textContent = project.title
  const meta = document.createElement('p')
  meta.className = 'project-meta'
  meta.textContent = [project.category, ...project.technologies, project.placeholder ? 'Sample project' : ''].filter(Boolean).join(' · ')
  const description = document.createElement('p')
  description.textContent = project.summary
  entry.append(heading, meta, description)
  list.append(entry)
}
const dispose = startHorses()
if (import.meta.hot) import.meta.hot.dispose(dispose)
