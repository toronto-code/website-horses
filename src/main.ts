import { mountHerd } from './scene/herd'
import { mountLettering } from './emboss/lettering'
import projects from './data/projects.json'

for (const [index, project] of projects.entries()) {
  const row = document.createElement('li')
  const number = document.createElement('span'), details = document.createElement('div')
  const title = document.createElement('h3'), desc = document.createElement('p')
  const stack = document.createElement('p'), year = document.createElement('span')
  number.className='number'; number.textContent=String(index+1).padStart(2,'0')
  if (project.url) {
    const link=document.createElement('a')
    link.href=project.url; link.textContent=project.title; title.append(link)
  } else title.textContent=project.title
  desc.textContent=project.description
  stack.className='stack'; stack.textContent=project.stack
  year.className='year'; year.textContent=project.year
  details.append(title,desc,stack);row.append(number,details,year)
  document.querySelector('#project-index')?.append(row)
}
void mountLettering()
const scene=document.querySelector<HTMLElement>('#herd')
const hero=document.querySelector<HTMLElement>('.hero')
if (scene && hero) void mountHerd(scene,hero).catch(() => scene.hidden=true)
