// Gera os cards roxos de estatísticas e linguagens (assets/*.svg).
// Roda no GitHub Actions todo dia; usa só o GITHUB_TOKEN e o fetch do Node.
import { mkdir, writeFile } from 'node:fs/promises';

const USER = process.env.GH_USER || 'Gustavo01010001';
const TOKEN = process.env.GITHUB_TOKEN;
const IGNORAR = new Set(['desktop-tutorial', USER]);

const query = `
query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    pullRequests { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes {
        name
        stargazerCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      totalCommitContributions
      contributionCalendar { totalContributions }
    }
  }
}`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables: { login: USER } })
});
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));
const u = data.user;

const repos = u.repositories.nodes.filter(r => !IGNORAR.has(r.name));
const estrelas = repos.reduce((s, r) => s + r.stargazerCount, 0);

const langs = new Map();
for (const r of repos) {
  for (const { size, node } of r.languages.edges) {
    const atual = langs.get(node.name) || { size: 0, color: node.color || '#9d4edd' };
    atual.size += size;
    langs.set(node.name, atual);
  }
}
const total = [...langs.values()].reduce((s, l) => s + l.size, 0) || 1;
const top = [...langs.entries()]
  .sort((a, b) => b[1].size - a[1].size)
  .slice(0, 8)
  .map(([name, l]) => ({ name, color: l.color, pct: (l.size / total) * 100 }));

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => n.toLocaleString('pt-BR');

const estilo = `
  <style>
    .titulo { font: 700 19px 'Segoe UI', Ubuntu, sans-serif; fill: #c77dff; }
    .label  { font: 400 14px 'Segoe UI', Ubuntu, sans-serif; fill: #e0d4ff; }
    .valor  { font: 700 14px 'Segoe UI', Ubuntu, sans-serif; fill: #ffffff; }
    .grande { font: 800 26px 'Segoe UI', Ubuntu, sans-serif; fill: #ffffff; }
    .peq    { font: 400 11px 'Segoe UI', Ubuntu, sans-serif; fill: #a38fc7; }
    .linha  { opacity: 0; animation: entra .5s ease forwards; }
    @keyframes entra { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
    .anel   { stroke-dasharray: 251; stroke-dashoffset: 251; animation: anel 1.4s ease .3s forwards; }
    @keyframes anel { to { stroke-dashoffset: 0; } }
  </style>
  <defs>
    <linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a0033"/>
      <stop offset="1" stop-color="#0d0117"/>
    </linearGradient>
    <linearGradient id="roxo" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7b2ff7"/>
      <stop offset="1" stop-color="#c77dff"/>
    </linearGradient>
  </defs>`;

// Card de estatísticas
const linhas = [
  ['Contribuições no último ano', u.contributionsCollection.contributionCalendar.totalContributions],
  ['Commits no último ano', u.contributionsCollection.totalCommitContributions],
  ['Repositórios públicos', repos.length],
  ['Pull requests', u.pullRequests.totalCount],
  estrelas > 0 ? ['Estrelas recebidas', estrelas] : ['Linguagens usadas', langs.size],
  ['Seguidores', u.followers.totalCount]
];

const stats = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="210" viewBox="0 0 460 210">
  ${estilo}
  <rect x="1" y="1" width="458" height="208" rx="12" fill="url(#fundo)" stroke="url(#roxo)" stroke-width="2"/>
  <text x="24" y="36" class="titulo">Estatísticas de ${esc(USER)}</text>
  ${linhas.map(([label, valor], i) => `
  <g class="linha" style="animation-delay:${0.1 + i * 0.12}s">
    <circle cx="30" cy="${64 + i * 24}" r="4" fill="#c77dff"/>
    <text x="44" y="${69 + i * 24}" class="label">${esc(label)}:</text>
    <text x="270" y="${69 + i * 24}" class="valor" text-anchor="end">${fmt(valor)}</text>
  </g>`).join('')}
  <g transform="translate(370 118)">
    <circle r="40" fill="none" stroke="#2a1145" stroke-width="7"/>
    <circle r="40" fill="none" stroke="url(#roxo)" stroke-width="7" stroke-linecap="round" class="anel" transform="rotate(-90)"/>
    <text y="6" class="grande" text-anchor="middle">${fmt(u.contributionsCollection.contributionCalendar.totalContributions)}</text>
    <text y="62" class="peq" text-anchor="middle">contribuições</text>
  </g>
</svg>`;

// Card de linguagens
let x = 24;
const barra = top.map(l => {
  const w = Math.max((l.pct / 100) * 412, 2);
  const seg = `<rect x="${x.toFixed(1)}" y="54" width="${w.toFixed(1)}" height="10" fill="${l.color}"/>`;
  x += w;
  return seg;
}).join('');

const altura = 92 + Math.ceil(top.length / 2) * 26;
const langsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="${altura}" viewBox="0 0 460 ${altura}">
  ${estilo}
  <clipPath id="arredonda"><rect x="24" y="54" width="412" height="10" rx="5"/></clipPath>
  <rect x="1" y="1" width="458" height="${altura - 2}" rx="12" fill="url(#fundo)" stroke="url(#roxo)" stroke-width="2"/>
  <text x="24" y="36" class="titulo">Linguagens mais usadas</text>
  <g clip-path="url(#arredonda)">${barra}</g>
  ${top.map((l, i) => {
    const cx = i % 2 === 0 ? 30 : 250;
    const cy = 92 + Math.floor(i / 2) * 26;
    return `
  <g class="linha" style="animation-delay:${0.15 + i * 0.1}s">
    <circle cx="${cx}" cy="${cy}" r="5" fill="${l.color}"/>
    <text x="${cx + 12}" y="${cy + 5}" class="label">${esc(l.name)} <tspan class="peq">${l.pct.toFixed(1).replace('.', ',')}%</tspan></text>
  </g>`;
  }).join('')}
</svg>`;

await mkdir('assets', { recursive: true });
await writeFile('assets/stats.svg', stats);
await writeFile('assets/linguagens.svg', langsSvg);
console.log('Cards gerados:', linhas.map(l => l.join(' = ')).join(' | '));
