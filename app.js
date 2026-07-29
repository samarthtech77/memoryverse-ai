const seedDocuments = [
  { id: 'cert-python', title: 'Python for Data Science Certificate', category: 'Certification', year: 2023, organisation: 'DataCamp', skills: ['Python', 'Pandas', 'Data Analysis'], summary: 'Completed a Python data analysis certification with practical assessment evidence.', type: 'PDF' },
  { id: 'club-lead', title: 'Data Science Club Lead', category: 'Achievement', year: 2024, organisation: 'University DS Club', skills: ['Leadership', 'Python', 'Machine Learning'], summary: 'Led the data science club and coordinated student machine learning workshops.', type: 'DOCX' },
  { id: 'vision-project', title: 'Plant Disease Detection System', category: 'Project', year: 2025, organisation: 'Personal Portfolio', skills: ['Python', 'Computer Vision', 'TensorFlow'], summary: 'Built a computer vision model that identifies plant diseases from leaf images.', type: 'PDF' },
  { id: 'internship', title: 'AI/ML Engineering Internship', category: 'Internship', year: 2025, organisation: 'Nexa Analytics', skills: ['Python', 'Machine Learning', 'SQL'], summary: 'Internship evidence for an AI/ML engineering role using prediction pipelines.', type: 'PDF' },
  { id: 'resume', title: 'Alex Sharma Resume — 2026', category: 'Academic', year: 2026, organisation: 'Alex Sharma', skills: ['Python', 'Machine Learning', 'React', 'SQL'], summary: 'Latest resume covering education, technical skills, projects, and experience.', type: 'PDF' },
  { id: 'memoryverse', title: 'MemoryVerse AI Project Report', category: 'Project', year: 2026, organisation: 'Hackathon Portfolio', skills: ['RAG', 'Semantic Search', 'JavaScript'], summary: 'Project report for an AI-powered digital identity system.', type: 'DOCX' }
];

let documents = [...seedDocuments];
let activeFilter = 'All';
const categoryKeywords = { Certification:['certificate','certification','course','badge'], Internship:['internship','intern','offer letter','training'], Project:['project','portfolio','report','application','system'], Achievement:['award','achievement','lead','winner','club'], Academic:['resume','cv','mark','transcript','degree','academic'] };
const skillKeywords = { Python:['python','pandas','numpy','django','flask'], 'Machine Learning':['machine learning','ml','model','classification','prediction'], 'Data Analysis':['data analysis','analytics','tableau','power bi'], 'Computer Vision':['computer vision','image','opencv','detection'], TensorFlow:['tensorflow','keras'], SQL:['sql','database'], React:['react','frontend','javascript'], RAG:['rag','retrieval augmented','vector database','embeddings'], 'Semantic Search':['semantic search','similarity','chromadb','vector search'], Leadership:['leadership','lead','managed','club'] };

const $ = selector => document.querySelector(selector);
const byId = id => documents.find(document => document.id === id);
const viewTitle = {home:'Good evening, Alex.', library:'Memory library', connections:'Connection engine', timeline:'Journey timeline'};

function iconFor(category) { return {Certification:'✦', Internship:'▣', Project:'◈', Achievement:'★', Academic:'▤'}[category] || '▧'; }
function saveDocuments() { localStorage.setItem('memoryverse-documents', JSON.stringify(documents.filter(document => !document.isSeed))); }
function restoreDocuments() { try { documents = [...seedDocuments, ...JSON.parse(localStorage.getItem('memoryverse-documents') || '[]')]; } catch { documents = [...seedDocuments]; } }
function renderMetrics() {
  const skills = new Set(documents.flatMap(document => document.skills));
  $('#metrics').innerHTML = [[documents.length, 'memories understood'], [skills.size, 'skills connected'], [connections().length, 'evidence links'], [new Set(documents.map(document => document.year)).size, 'years of growth']].map(([number,label]) => `<article class="metric"><strong>${number}</strong><span>${label}</span></article>`).join('');
}
function card(document) {
  const template = $('#document-template').content.cloneNode(true);
  const element = template.querySelector('.document-card');
  element.querySelector('.file-icon').textContent = iconFor(document.category);
  element.querySelector('.category-pill').textContent = document.category;
  element.querySelector('h3').textContent = document.title;
  element.querySelector('.document-meta').textContent = `${document.organisation} · ${document.year}`;
  element.querySelector('.skill-tags').innerHTML = document.skills.slice(0, 3).map(skill => `<span>${skill}</span>`).join('');
  element.querySelector('.source-button').addEventListener('click', () => openSource(document));
  return element;
}
function renderDocuments() {
  const recent = documents.slice(-3).reverse();
  $('#recent-documents').replaceChildren(...recent.map(card));
  const selected = activeFilter === 'All' ? documents : documents.filter(document => document.category === activeFilter);
  $('#library-documents').replaceChildren(...selected.slice().reverse().map(card));
  const filters = ['All', ...Object.keys(categoryKeywords)];
  $('#filters').innerHTML = filters.map(filter => `<button class="${filter === activeFilter ? 'active' : ''}" data-filter="${filter}">${filter}</button>`).join('');
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { activeFilter = button.dataset.filter; renderDocuments(); }));
}
function openSource(document) {
  if (document.sourceUrl) { window.open(document.sourceUrl, '_blank', 'noopener'); return; }
  if (document.url) { window.open(document.url, '_blank', 'noopener'); return; }
  const content = `MemoryVerse source preview\n\n${document.title}\n${document.summary}\n\nCategory: ${document.category}\nSkills: ${document.skills.join(', ')}\nYear: ${document.year}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  window.open(url, '_blank', 'noopener');
}
function connections() {
  const pairs = [];
  documents.forEach((left, index) => documents.slice(index + 1).forEach(right => {
    const shared = left.skills.filter(skill => right.skills.includes(skill));
    if (!shared.length) return;
    const distance = Math.abs(left.year - right.year);
    const confidence = Math.min(98, 64 + shared.length * 11 + (distance <= 2 ? 7 : 0));
    pairs.push({ left, right, shared, confidence });
  }));
  return pairs.sort((a,b) => b.confidence - a.confidence);
}
function renderConnections() {
  const skills = [...new Set(documents.flatMap(document => document.skills))];
  $('#skill-map').innerHTML = skills.map(skill => `<button class="skill-node" data-skill="${skill}">${skill}<small>${documents.filter(document => document.skills.includes(skill)).length}</small></button>`).join('');
  $('#connection-list').innerHTML = connections().slice(0, 9).map(({left,right,shared,confidence}) => `<article class="connection"><strong>${left.title} <span>↔</span> ${right.title}</strong><p>${confidence}% confidence · Connected through <b>${shared.join(', ')}</b>. Both records include this evidence.</p></article>`).join('') || '<p>No connections yet. Add a document with skills to generate links.</p>';
  document.querySelectorAll('[data-skill]').forEach(button => button.addEventListener('click', () => ask(`What supports my ${button.dataset.skill} skill?`)));
}
function renderTimeline() {
  const years = [...new Set(documents.map(document => document.year))].sort((a,b) => a-b);
  $('#timeline-list').innerHTML = years.map(year => `<div class="year-row"><div class="year">${year}</div><div>${documents.filter(document => document.year === year).map(document => `<article class="milestone"><h3>${document.title}</h3><p>${document.category} · ${document.organisation} · ${document.skills.join(', ')}</p></article>`).join('')}</div></div>`).join('');
}
function tokens(text) { return text.toLowerCase().replace(/[^a-z0-9+# ]/g, ' ').split(/\s+/).filter(word => word.length > 1); }
function search(query) {
  const queryText = query.toLowerCase(); const queryTokens = tokens(queryText);
  const requestedCategory = Object.keys(categoryKeywords).find(category => categoryKeywords[category].some(keyword => queryText.includes(keyword))) || (queryText.includes('certificate') ? 'Certification' : null);
  const requestedSkills = Object.keys(skillKeywords).filter(skill => queryText.includes(skill.toLowerCase()) || skillKeywords[skill].some(keyword => queryText.includes(keyword)));
  const ranked = documents.map(document => {
    const haystack = `${document.title} ${document.category} ${document.organisation} ${document.skills.join(' ')} ${document.summary}`.toLowerCase();
    let score = queryTokens.reduce((total, word) => total + (haystack.includes(word) ? 3 : 0), 0);
    if (requestedCategory && document.category === requestedCategory) score += 18;
    requestedSkills.forEach(skill => { if (document.skills.includes(skill)) score += 15; });
    return { document, score };
  }).filter(result => result.score > 0).sort((a,b) => b.score - a.score).slice(0, 4);
  return { ranked, requestedCategory, requestedSkills };
}
function ask(query) {
  const cleanQuery = query.trim(); if (!cleanQuery) return;
  $('#ask-input').value = cleanQuery;
  const {ranked, requestedCategory, requestedSkills} = search(cleanQuery);
  const panel = $('#answer-panel'); panel.classList.remove('hidden');
  if (!ranked.length) { panel.innerHTML = `<p>I could not find evidence for “${cleanQuery}”. Upload another document or try a skill/category such as Python, certificates, or projects.</p>`; return; }
  const topic = requestedSkills.length ? requestedSkills.join(' and ') : requestedCategory || 'your query';
  panel.innerHTML = `<p><strong>Found ${ranked.length} evidence-backed memories for ${topic}.</strong> MemoryVerse ranked these using matches in titles, extracted skills, categories, and source summaries. Open any original to verify it.</p><div class="answer-results">${ranked.map(({document}) => `<button data-result="${document.id}">${document.title} ↗</button>`).join('')}</div>`;
  panel.querySelectorAll('[data-result]').forEach(button => button.addEventListener('click', () => openSource(byId(button.dataset.result))));
}
function inferDocument(file) {
  const filename = file.name.replace(/\.[^.]+$/, ''); const text = filename.toLowerCase();
  const category = Object.keys(categoryKeywords).map(key => [key, categoryKeywords[key].filter(word => text.includes(word)).length]).sort((a,b) => b[1]-a[1])[0];
  const skills = Object.keys(skillKeywords).filter(skill => skillKeywords[skill].some(word => text.includes(word))).slice(0, 4);
  const yearMatch = text.match(/20(1\d|2\d|3\d)/); const url = URL.createObjectURL(file);
  return { id:`upload-${Date.now()}-${Math.random().toString(16).slice(2)}`, title:filename, category:category?.[1] ? category[0] : 'Academic', year:yearMatch ? Number(yearMatch[0]) : new Date().getFullYear(), organisation:'Uploaded evidence', skills:skills.length ? skills : ['New evidence'], summary:`Locally indexed from ${file.name}. Add a descriptive filename with skills or category terms for richer automatic understanding.`, type:file.name.split('.').pop().toUpperCase(), url };
}
async function handleFiles(files) {
  const uploaded = await Promise.all(Array.from(files).map(async file => {
    try {
      const formData = new FormData(); formData.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      return (await response.json()).document;
    } catch { return inferDocument(file); }
  }));
  documents.push(...uploaded); saveDocuments(); refresh(); activeFilter='All'; showView('library');
}
async function loadBackendDocuments() {
  try {
    const response = await fetch('/api/documents');
    if (!response.ok) return;
    const payload = await response.json();
    const existingIds = new Set(documents.map(document => document.id));
    documents.push(...payload.documents.filter(document => !existingIds.has(document.id)));
    refresh();
  } catch { /* Opening index.html directly remains supported. */ }
}
function showView(view) { document.querySelectorAll('.view').forEach(element => element.classList.toggle('active', element.id === view)); document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view)); $('#page-title').textContent = viewTitle[view]; }
function refresh() { renderMetrics(); renderDocuments(); renderConnections(); renderTimeline(); }

restoreDocuments(); refresh();
loadBackendDocuments();
document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showView(button.dataset.go)));
$('#ask-button').addEventListener('click', () => ask($('#ask-input').value));
$('#ask-input').addEventListener('keydown', event => { if (event.key === 'Enter') ask(event.target.value); });
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => ask(button.dataset.query)));
$('#file-input').addEventListener('change', event => handleFiles(event.target.files));
