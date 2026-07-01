const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const token = () => localStorage.getItem('token');
const setToken = t => localStorage.setItem('token', t);
const logout = () => { localStorage.removeItem('token'); location.href='/login.html'; };
const api = async (url, opts={}) => {
  const headers = opts.headers || {};
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token()) headers.Authorization = 'Bearer ' + token();
  const res = await fetch(url, { ...opts, headers });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
};
function nav(){
  const logged = !!token();
  const box = $('#navLinks'); if(!box) return;
  box.innerHTML = `<a href='/'>Главная</a><a href='/games.html'>Игры</a><a href='/leaderboard.html'>Участники</a>${logged?`<a href='/cabinet.html'>Кабинет</a><a href='/admin.html' class='admin-link' style='display:none'>Админ</a><button class='btn danger' onclick='logout()'>Выйти</button>`:`<a href='/login.html'>Вход</a><a href='/register.html'>Регистрация</a>`}`;
  if(logged) api('/api/me').then(d=>{ if(d.user.role==='admin') $$('.admin-link').forEach(x=>x.style.display='inline-block'); }).catch(()=>{});
}
function msg(text, bad=false){ const m=$('#msg'); if(m){m.textContent=text;m.className=bad?'msg error':'msg';}}
async function requireAuth(){ if(!token()){ location.href='/login.html'; return null;} try{return await api('/api/me')}catch(e){logout();}}
async function requireAdmin(){ const d=await requireAuth(); if(!d) return null; if(d.user.role!=='admin'){ location.href='/cabinet.html'; return null;} return d; }

async function loginForm(){ $('#loginForm')?.addEventListener('submit', async e=>{e.preventDefault(); try{const d=await api('/api/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))}); setToken(d.token); location.href='/cabinet.html';}catch(err){msg(err.message,true)}}); }
async function registerForm(){ $('#registerForm')?.addEventListener('submit', async e=>{e.preventDefault(); try{const d=await api('/api/register',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))}); setToken(d.token); location.href='/cabinet.html';}catch(err){msg(err.message,true)}}); }
async function cabinet(){
  const d=await requireAuth(); if(!d) return;
  const u=d.user;
  $('#profile').innerHTML=`<img class='avatar' src='${u.avatar||'/default-avatar.svg'}'><h2>${u.nickname}</h2><p class='muted'>@${u.username} · <span class='pill'>${u.role}</span></p><div class='stats'><div class='stat'><span>Очки</span><b>${u.points}</b></div><div class='stat'><span>Игр пройдено</span><b>${u.completed_count}</b></div><div class='stat'><span>Игр в пуле</span><b>${(d.pool||[]).length}</b></div></div>`;
  $('#nickname').value=u.nickname;
  $('#nickForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/me',{method:'PATCH',body:JSON.stringify({nickname:$('#nickname').value})});location.reload()}catch(err){msg(err.message,true)}};
  $('#avatarForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/me/avatar',{method:'POST',body:new FormData(e.target),headers:{}});location.reload()}catch(err){msg(err.message,true)}};
  function renderPool(pool){
    const rows=(pool||[]).map(g=>`<tr><td>#${g.position}</td><td><b>${g.title}</b><div class='muted'>${g.description||''}</div></td><td>${g.points}</td><td>${g.completed?'<span class=pill>Пройдено</span>':`<button class='btn ok' onclick='completeGame(${g.id})'>Получить очки</button>`}</td></tr>`).join('');
    if($('#poolRows')) $('#poolRows').innerHTML=rows||`<tr><td colspan='4'>Пул ещё не сгенерирован. Нажми «Роллить пул».</td></tr>`;
  }
  renderPool(d.pool);
  $('#rollPoolBtn')?.addEventListener('click', async ()=>{
    if(!confirm('Сгенерировать новый пул? Старый пул в профиле будет заменён.')) return;
    try{const r=await api('/api/me/roll-pool',{method:'POST'}); renderPool(r.pool); msg('Пул игр обновлён'); setTimeout(()=>location.reload(),700)}catch(err){msg(err.message,true)}
  });
  $('#completed').innerHTML=d.completed.map(g=>`<tr><td>${g.title}</td><td>${g.points}</td><td>${new Date(g.completed_at).toLocaleString()}</td></tr>`).join('')||`<tr><td colspan='3'>Пока нет пройденных игр</td></tr>`;
}
async function gamesPage(){ await requireAuth(); const d=await api('/api/games'); const rows=d.games.map(g=>`<tr><td><b>${g.title}</b><div class='muted'>${g.description||''}</div></td><td>${g.points}</td></tr>`).join(''); $('#gamesRows').innerHTML=rows||`<tr><td colspan='2'>Игр пока нет</td></tr>`; const me=await api('/api/me'); if(me.user.role==='admin') $('#adminGameLink').style.display='inline-block'; }
async function completeGame(id){ try{await api(`/api/games/${id}/complete`,{method:'POST'}); location.reload();}catch(e){alert(e.message)} }
async function leaderboard(){ await requireAuth(); const d=await api('/api/leaderboard'); $('#leaders').innerHTML=d.users.map((u,i)=>`<tr><td>#${i+1}</td><td><a class='player-link' href='/player.html?id=${u.id}'><img class='avatar' style='width:42px;height:42px' src='${u.avatar||'/default-avatar.svg'}'> <b>${esc(u.nickname)}</b></a> <span class='muted'>@${esc(u.username)}</span></td><td>${u.points}</td><td>${u.completed_count}</td></tr>`).join(''); }
async function playerProfile(){
  await requireAuth();
  const id = new URLSearchParams(location.search).get('id');
  if(!id){ location.href='/leaderboard.html'; return; }
  try{
    const d = await api('/api/users/'+id+'/profile');
    const u = d.user;
    $('#playerProfile').innerHTML = `<img class='avatar big' src='${u.avatar||'/default-avatar.svg'}'><h2>${esc(u.nickname)}</h2><p class='muted'>@${esc(u.username)} · <span class='pill'>${u.role}</span></p><div class='stats'><div class='stat'><span>Очки</span><b>${u.points}</b></div><div class='stat'><span>Игр пройдено</span><b>${u.completed_count}</b></div><div class='stat'><span>Игр в пуле</span><b>${(d.pool||[]).length}</b></div></div>`;
    $('#playerPool').innerHTML = (d.pool||[]).map(g=>`<tr><td>#${g.position}</td><td><b>${esc(g.title)}</b><div class='muted'>${esc(g.description||'')}</div></td><td>${g.points}</td><td>${g.completed?'<span class=pill>Пройдено</span>':'<span class=muted>Не пройдено</span>'}</td></tr>`).join('') || `<tr><td colspan='4'>У игрока пока нет пула игр</td></tr>`;
    $('#playerCompleted').innerHTML = (d.completed||[]).map(g=>`<tr><td>${esc(g.title)}</td><td>${g.points}</td><td>${new Date(g.completed_at).toLocaleString()}</td></tr>`).join('') || `<tr><td colspan='3'>Пока нет пройденных игр</td></tr>`;
  }catch(e){ $('#playerProfile').innerHTML = `<p class='msg error'>${esc(e.message)}</p>`; }
} 
async function adminHome(){ const d=await requireAdmin(); if(d) $('#adminName').textContent=d.user.nickname; }
async function adminGames(){ await requireAdmin(); async function load(){ const d=await api('/api/games'); $('#adminGames').innerHTML=d.games.map(g=>`<tr><td><input id='t${g.id}' value='${g.title.replaceAll("'",'&#39;')}'></td><td><input id='p${g.id}' type='number' value='${g.points}'></td><td><textarea id='d${g.id}'>${g.description||''}</textarea></td><td class='actions'><button class='btn ok' onclick='saveGame(${g.id})'>Сохранить</button><button class='btn danger' onclick='deleteGame(${g.id})'>Удалить</button></td></tr>`).join(''); } window.saveGame=async id=>{try{await api('/api/admin/games/'+id,{method:'PATCH',body:JSON.stringify({title:$('#t'+id).value,points:$('#p'+id).value,description:$('#d'+id).value})});msg('Сохранено')}catch(e){msg(e.message,true)}}; window.deleteGame=async id=>{if(confirm('Удалить игру?')){await api('/api/admin/games/'+id,{method:'DELETE'});load();}}; $('#newGame').onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/games',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();load();}catch(err){msg(err.message,true)}}; load(); }
async function adminUsers(){ await requireAdmin(); async function load(){ const d=await api('/api/admin/users'); $('#adminUsers').innerHTML=d.users.map(u=>`<tr><td>${u.id}</td><td>${u.username}</td><td><input id='n${u.id}' value='${u.nickname.replaceAll("'",'&#39;')}'></td><td><select id='r${u.id}'><option ${u.role==='player'?'selected':''}>player</option><option ${u.role==='admin'?'selected':''}>admin</option></select></td><td><input id='pts${u.id}' type='number' value='${u.points}'></td><td><input id='cnt${u.id}' type='number' value='${u.completed_count}'></td><td class='actions'><button class='btn ok' onclick='saveUser(${u.id})'>Сохранить</button><button class='btn danger' onclick='deleteUser(${u.id})'>Удалить</button></td></tr>`).join(''); } window.saveUser=async id=>{try{await api('/api/admin/users/'+id,{method:'PATCH',body:JSON.stringify({nickname:$('#n'+id).value,role:$('#r'+id).value,points:Number($('#pts'+id).value),completed_count:Number($('#cnt'+id).value)})});msg('Игрок сохранён')}catch(e){msg(e.message,true)}}; window.deleteUser=async id=>{if(confirm('Удалить игрока?')){try{await api('/api/admin/users/'+id,{method:'DELETE'});load()}catch(e){msg(e.message,true)}}}; load(); }

nav();
window.logout=logout; window.completeGame=completeGame;
document.addEventListener('DOMContentLoaded',()=>{loginForm();registerForm(); if($('#profile')) cabinet(); if($('#gamesRows')) gamesPage(); if($('#leaders')) leaderboard(); if($('#playerProfile')) playerProfile(); if($('#adminName')) adminHome(); if($('#adminGames')) adminGames(); if($('#adminUsers')) adminUsers();});
