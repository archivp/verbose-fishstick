require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Можно загружать только изображения'));
    cb(null, true);
  }
});

let db;
const DEFAULT_GAMES = [
  {
    "title": "Overlord: Raising Hell",
    "points": 12,
    "description": "Пройти игру"
  },
  {
    "title": "Metal Gear Rising «Normal»",
    "points": 7,
    "description": "Пройти игру с условием/сложностью: Normal"
  },
  {
    "title": "Resident Evil 2 «Hardcore»",
    "points": 9,
    "description": "Пройти игру с условием/сложностью: Hardcore"
  },
  {
    "title": "Control",
    "points": 12,
    "description": "Пройти игру"
  },
  {
    "title": "Risk of Rain 2 «Муссон/Митрикс»",
    "points": 20,
    "description": "Победить Митрикса на сложности Муссон"
  },
  {
    "title": "Enter the Gungeon «Лич»",
    "points": 25,
    "description": "Победить Лича"
  },
  {
    "title": "Amnesia: The Dark Descent",
    "points": 8,
    "description": "Пройти игру"
  },
  {
    "title": "Dead Space «Тяжёлый»",
    "points": 12,
    "description": "Пройти игру с условием/сложностью: Тяжёлый"
  },
  {
    "title": "Metafor ReFantazio «Hard»",
    "points": 70,
    "description": "Пройти игру с условием/сложностью: Hard"
  },
  {
    "title": "Hollow Knight «Грёз больше нет/Путь боли/Боссы грёз»",
    "points": 55,
    "description": "Пройти игру на концовку «Грёз больше нет», пройти Путь боли и победить боссов грёз"
  },
  {
    "title": "CupHead + DLC",
    "points": 20,
    "description": "Пройти игру и DLC"
  },
  {
    "title": "Outlast «Высокая»",
    "points": 6,
    "description": "Пройти игру с условием/сложностью: Высокая"
  },
  {
    "title": "Celeste",
    "points": 10,
    "description": "Пройти игру"
  },
  {
    "title": "Half Life «Высокий»",
    "points": 12,
    "description": "Пройти игру с условием/сложностью: Высокий"
  },
  {
    "title": "bayonetta",
    "points": 12,
    "description": "Пройти игру"
  },
  {
    "title": "Dragon Age: Origins «Сложная»",
    "points": 45,
    "description": "Пройти игру с условием/сложностью: Сложная"
  },
  {
    "title": "Ben and Ed",
    "points": 6,
    "description": "Пройти игру"
  },
  {
    "title": "ULTRAKILL",
    "points": 8,
    "description": "Пройти игру"
  },
  {
    "title": "Cry of fear",
    "points": 8,
    "description": "Пройти игру"
  },
  {
    "title": "Darksiders 3  «Судный день»",
    "points": 18,
    "description": "Пройти игру с условием/сложностью: Судный день"
  },
  {
    "title": "DMC 5 «Сын Спарды»",
    "points": 13,
    "description": "Пройти игру с условием/сложностью: Сын Спарды"
  },
  {
    "title": "Assassinas 1 (100% на заданиях)",
    "points": 20,
    "description": "Пройти игру"
  },
  {
    "title": "Potion Craft: Alchemist Simulator «Грандмастер»",
    "points": 25,
    "description": "Пройти игру с условием/сложностью: Грандмастер"
  },
  {
    "title": "Batman: Arkham Asylum",
    "points": 18,
    "description": "Пройти игру"
  },
  {
    "title": "Machinarium",
    "points": 6,
    "description": "Пройти игру"
  },
  {
    "title": "Freddi Fish 5: The Case of the Creature of Coral Cove",
    "points": 2,
    "description": "Пройти игру"
  },
  {
    "title": "Вангеры",
    "points": 20,
    "description": "Пройти игру"
  },
  {
    "title": "I Wanna Be The Boshy",
    "points": 30,
    "description": "Пройти игру"
  },
  {
    "title": "Changed",
    "points": 5,
    "description": "Пройти игру"
  },
  {
    "title": "Metel - Horror Escape",
    "points": 3,
    "description": "Пройти игру"
  },
  {
    "title": "Петька и Василий Иванович Спасают Галактику. Перезагрузка",
    "points": 6,
    "description": "Пройти игру"
  },
  {
    "title": "Portal 2",
    "points": 8,
    "description": "Пройти игру"
  },
  {
    "title": "Hades «Адский режим»",
    "points": 25,
    "description": "Пройти игру с условием/сложностью: Адский режим"
  },
  {
    "title": "Dead Cells «Король»",
    "points": 25,
    "description": "Победить Десницу Короля/Короля"
  },
  {
    "title": "Hornyline Miami 2",
    "points": 8,
    "description": "Пройти игру"
  },
  {
    "title": "Ghostrunner",
    "points": 7,
    "description": "Пройти игру"
  },
  {
    "title": "Super Meat Boy",
    "points": 12,
    "description": "Пройти игру"
  },
  {
    "title": "Battletoads",
    "points": 5,
    "description": "Пройти игру"
  },
  {
    "title": "Just Cause 3",
    "points": 18,
    "description": "Пройти игру"
  },
  {
    "title": "Only up",
    "points": 4,
    "description": "Пройти игру"
  },
  {
    "title": "Getting Over It with Bennett Foddy",
    "points": 6,
    "description": "Пройти игру"
  },
  {
    "title": "Visage",
    "points": 8,
    "description": "Пройти игру"
  },
  {
    "title": "Fear and Hunger",
    "points": 15,
    "description": "Пройти игру"
  },
  {
    "title": "Dark Souls 2: Scholar of the First Sin «Без DLC»",
    "points": 45,
    "description": "Пройти игру с условием/сложностью: Без DLC"
  },
  {
    "title": "Шрек 2",
    "points": 5,
    "description": "Пройти игру"
  },
  {
    "title": "Мадагаскар",
    "points": 5,
    "description": "Пройти игру"
  },
  {
    "title": "Ледниковый период",
    "points": 5,
    "description": "Пройти игру"
  },
  {
    "title": "Антошка: Веселые книжки",
    "points": 2,
    "description": "Пройти игру"
  },
  {
    "title": "Geometry dash «Clubstep»",
    "points": 10,
    "description": "Пройти все уровни до Clubstep включительно"
  },
  {
    "title": "Sifu «Master»",
    "points": 15,
    "description": "Пройти игру с условием/сложностью: Master"
  },
  {
    "title": "Minecraft «Hardcore»",
    "points": 30,
    "description": "Пройти игру с условием/сложностью: Hardcore"
  },
  {
    "title": "Katana Zero",
    "points": 5,
    "description": "Пройти игру"
  },
  {
    "title": "Witcher «Тяжёлый»",
    "points": 35,
    "description": "Пройти игру с условием/сложностью: Тяжёлый"
  },
  {
    "title": "Nier: Automata «Тяжёлый/Концовки A,B,C»",
    "points": 35,
    "description": "Пройти игру с условием/сложностью: Тяжёлый/Концовки A,B,C"
  },
  {
    "title": "Chants of Sennaar",
    "points": 9,
    "description": "Пройти игру"
  },
  {
    "title": "Stellaris «Вся галактика/Командор»",
    "points": 80,
    "description": "Захватить всю галактику на сложности Командор"
  },
  {
    "title": "Thronebreaker: The Witcher Tales «Bonebreaker»",
    "points": 35,
    "description": "Пройти игру с условием/сложностью: Bonebreaker"
  },
  {
    "title": "The Messenger",
    "points": 12,
    "description": "Пройти игру"
  },
  {
    "title": "Prince of Persia: The Sands of Time",
    "points": 9,
    "description": "Пройти игру"
  },
  {
    "title": "XCOM2 «Легенда»",
    "points": 40,
    "description": "Пройти игру с условием/сложностью: Легенда"
  },
  {
    "title": "God of War (2018) «Дайте мне Бога Войны/Все валькирии»",
    "points": 45,
    "description": "Пройти на «Дайте мне Бога Войны» и победить всех валькирий"
  },
  {
    "title": "Donkey Kong N64",
    "points": 10,
    "description": "Пройти игру"
  },
  {
    "title": "Nuclear Throne",
    "points": 15,
    "description": "Пройти игру"
  },
  {
    "title": "Slay the spire «Убить сердце»",
    "points": 30,
    "description": "Убить сердце"
  },
  {
    "title": "Sonic Adventure DX",
    "points": 10,
    "description": "Пройти игру"
  },
  {
    "title": "Diablo 2 «Nightmare»",
    "points": 40,
    "description": "Пройти игру с условием/сложностью: Nightmare"
  },
  {
    "title": "The Evil Within «Обычный»",
    "points": 15,
    "description": "Пройти игру с условием/сложностью: Обычный"
  },
  {
    "title": "Dishonored «Высокий»",
    "points": 15,
    "description": "Пройти игру с условием/сложностью: Высокий"
  },
  {
    "title": "Grand Theft Auto: Vice city",
    "points": 18,
    "description": "Пройти игру"
  },
  {
    "title": "BioShock Infinity «Сложный»",
    "points": 12,
    "description": "Пройти игру с условием/сложностью: Сложный"
  },
  {
    "title": "Mafia 2 defender dexp edition",
    "points": 12,
    "description": "Пройти игру"
  },
  {
    "title": "Mirror's Edge Catalyst",
    "points": 8,
    "description": "Пройти игру"
  },
  {
    "title": "MAD MAX",
    "points": 20,
    "description": "Пройти игру"
  },
  {
    "title": "Crysis 3 «Суперсолдат»",
    "points": 8,
    "description": "Пройти игру с условием/сложностью: Суперсолдат"
  },
  {
    "title": "Thief (2014) «Высокий»",
    "points": 15,
    "description": "Пройти игру с условием/сложностью: Высокий"
  },
  {
    "title": "Spider-Man: Web of Shadows",
    "points": 10,
    "description": "Пройти игру"
  },
  {
    "title": "Papers, Please «Хорошие концовки»",
    "points": 8,
    "description": "Получить одну из хороших концовок"
  },
  {
    "title": "Sniper: Ghost Warrior",
    "points": 7,
    "description": "Пройти игру"
  },
  {
    "title": "Sniper elite 3",
    "points": 12,
    "description": "Пройти игру"
  },
  {
    "title": "Teenage Mutant Ninja Turtles: The Video Game",
    "points": 5,
    "description": "Пройти игру"
  },
  {
    "title": "Hello Neighbor",
    "points": 5,
    "description": "Пройти игру"
  },
  {
    "title": "Rabbids Go Home",
    "points": 8,
    "description": "Пройти игру"
  },
  {
    "title": "Far cry 3 «Тяжелый»",
    "points": 18,
    "description": "Пройти игру с условием/сложностью: Тяжелый"
  },
  {
    "title": "Max Payne 3 «Хардкор»",
    "points": 12,
    "description": "Пройти игру с условием/сложностью: Хардкор"
  },
  {
    "title": "Sonic Mania",
    "points": 6,
    "description": "Пройти игру"
  },
  {
    "title": "The Matchless Kungfu",
    "points": 30,
    "description": "Пройти игру"
  },
  {
    "title": "Prototype",
    "points": 12,
    "description": "Пройти игру"
  },
  {
    "title": "Deus Ex: Human Revolution - Director's Cut «Hard»",
    "points": 25,
    "description": "Пройти игру с условием/сложностью: Hard"
  },
  {
    "title": "Songs of Conquest «Рискованно»",
    "points": 25,
    "description": "Пройти игру с условием/сложностью: Рискованно"
  },
  {
    "title": "The Legend of Zelda: Breath of the wild «Все звери»",
    "points": 50,
    "description": "Освободить всех священных зверей и пройти игру"
  },
  {
    "title": "Disney Pixar Cars",
    "points": 6,
    "description": "Пройти игру"
  },
  {
    "title": "Darkest Dungeon «Тьма»",
    "points": 80,
    "description": "Пройти на сложности «Тьма», без DLC Crimson Court"
  },
  {
    "title": "Against the Storm",
    "points": 40,
    "description": "Пройти игру, восстановив 4 руны"
  },
  {
    "title": "Doom 3 «Veteran»",
    "points": 12,
    "description": "Пройти игру с условием/сложностью: Veteran"
  },
  {
    "title": "NARUTO X BORUTO Ultimate Ninja STORM CONNECTIONS",
    "points": 6,
    "description": "Пройти игру"
  },
  {
    "title": "Clair Obscur: Expedition 33",
    "points": 35,
    "description": "Пройти Акт III на сложности «Вызов»"
  },
  {
    "title": "System Shock Remake",
    "points": 20,
    "description": "Пройти игру на уровнях сложности 2"
  },
  {
    "title": "Kung Fu Panda",
    "points": 6,
    "description": "Пройти игру"
  },
  {
    "title": "Grim Dawn",
    "points": 35,
    "description": "Пройти игру"
  },
  {
    "title": "Spider-Man Shattered Dimensions «Высокий»",
    "points": 10,
    "description": "Пройти игру с условием/сложностью: Высокий"
  },
  {
    "title": "Swords and Souls: Neverseen",
    "points": 15,
    "description": "Пройти игру"
  }
];

function tokenFor(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Нужна авторизация' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Сессия истекла. Войдите снова.' }); }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Доступ только для админа' });
  next();
}

async function userPublic(id) {
  const u = await db.get(`SELECT id, username, nickname, role, avatar, points, completed_count, created_at FROM users WHERE id=?`, id);
  return u;
}

async function init() {
  db = await open({ filename: path.join(DATA_DIR, 'database.sqlite'), driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      avatar TEXT DEFAULT '',
      points INTEGER NOT NULL DEFAULT 0,
      completed_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS completions (
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, game_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS user_pools (
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      rolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, game_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
    );
  `);
  const adminName = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const exists = await db.get(`SELECT id FROM users WHERE username=?`, adminName);
  if (!exists) {
    await db.run(`INSERT INTO users(username,password_hash,nickname,role) VALUES(?,?,?,?)`,
      adminName, await bcrypt.hash(adminPass, 10), 'Главный админ', 'admin');
  }
  const gameCount = await db.get(`SELECT COUNT(*) as c FROM games`);
  if (gameCount.c === 0) {
    for (const game of DEFAULT_GAMES) {
      await db.run(`INSERT INTO games(title,points,description) VALUES(?,?,?)`, game.title, game.points, game.description);
    }
  }
}

app.post('/api/register', async (req, res) => {
  const { username, password, nickname } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Введите логин и пароль' });
  if (String(password).length < 4) return res.status(400).json({ error: 'Пароль минимум 4 символа' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.run(`INSERT INTO users(username,password_hash,nickname) VALUES(?,?,?)`, username.trim(), hash, (nickname || username).trim());
    const user = await userPublic(result.lastID);
    res.json({ token: tokenFor(user), user });
  } catch (e) {
    res.status(400).json({ error: 'Такой логин уже занят' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get(`SELECT * FROM users WHERE username=?`, String(username || '').trim());
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) return res.status(401).json({ error: 'Неверный логин или пароль' });
  res.json({ token: tokenFor(user), user: await userPublic(user.id) });
});

app.get('/api/me', auth, async (req, res) => {
  const user = await userPublic(req.user.id);
  const completed = await db.all(`SELECT g.id, g.title, g.points, c.completed_at FROM completions c JOIN games g ON g.id=c.game_id WHERE c.user_id=? ORDER BY c.completed_at DESC`, req.user.id);
  const pool = await db.all(`
    SELECT g.id, g.title, g.points, g.description, p.position, p.rolled_at,
           CASE WHEN c.user_id IS NULL THEN 0 ELSE 1 END as completed
    FROM user_pools p
    JOIN games g ON g.id=p.game_id
    LEFT JOIN completions c ON c.game_id=g.id AND c.user_id=p.user_id
    WHERE p.user_id=?
    ORDER BY p.position ASC
  `, req.user.id);
  res.json({ user, completed, pool });
});

app.post('/api/me/roll-pool', auth, async (req, res) => {
  const games = await db.all(`SELECT id FROM games ORDER BY RANDOM() LIMIT 20`);
  if (!games.length) return res.status(400).json({ error: 'Сначала админ должен добавить игры в таблицу' });
  try {
    await db.run('BEGIN');
    await db.run(`DELETE FROM user_pools WHERE user_id=?`, req.user.id);
    for (let i = 0; i < games.length; i++) {
      await db.run(`INSERT INTO user_pools(user_id,game_id,position) VALUES(?,?,?)`, req.user.id, games[i].id, i + 1);
    }
    await db.run('COMMIT');
    const pool = await db.all(`
      SELECT g.id, g.title, g.points, g.description, p.position, p.rolled_at,
             CASE WHEN c.user_id IS NULL THEN 0 ELSE 1 END as completed
      FROM user_pools p
      JOIN games g ON g.id=p.game_id
      LEFT JOIN completions c ON c.game_id=g.id AND c.user_id=p.user_id
      WHERE p.user_id=?
      ORDER BY p.position ASC
    `, req.user.id);
    res.json({ ok: true, pool });
  } catch (e) {
    await db.run('ROLLBACK').catch(() => {});
    res.status(500).json({ error: 'Не удалось сгенерировать пул игр' });
  }
});

app.patch('/api/me', auth, async (req, res) => {
  const nickname = String(req.body.nickname || '').trim();
  if (!nickname) return res.status(400).json({ error: 'Ник не может быть пустым' });
  await db.run(`UPDATE users SET nickname=? WHERE id=?`, nickname, req.user.id);
  res.json({ user: await userPublic(req.user.id) });
});

app.post('/api/me/avatar', auth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Выберите файл' });
  const avatar = `/uploads/${req.file.filename}`;
  await db.run(`UPDATE users SET avatar=? WHERE id=?`, avatar, req.user.id);
  res.json({ avatar, user: await userPublic(req.user.id) });
});

app.get('/api/games', auth, async (req, res) => {
  const games = await db.all(`SELECT g.*, CASE WHEN c.user_id IS NULL THEN 0 ELSE 1 END as completed FROM games g LEFT JOIN completions c ON c.game_id=g.id AND c.user_id=? ORDER BY g.points DESC, g.title`, req.user.id);
  res.json({ games });
});

app.post('/api/games/:id/complete', auth, async (req, res) => {
  const game = await db.get(`SELECT * FROM games WHERE id=?`, req.params.id);
  if (!game) return res.status(404).json({ error: 'Игра не найдена' });
  try {
    await db.run('BEGIN');
    await db.run(`INSERT INTO completions(user_id,game_id) VALUES(?,?)`, req.user.id, game.id);
    await db.run(`UPDATE users SET points=points+?, completed_count=completed_count+1 WHERE id=?`, game.points, req.user.id);
    await db.run('COMMIT');
    res.json({ ok: true, user: await userPublic(req.user.id) });
  } catch (e) {
    await db.run('ROLLBACK').catch(() => {});
    res.status(400).json({ error: 'Эта игра уже отмечена как пройденная' });
  }
});


app.get('/api/users/:id/profile', auth, async (req, res) => {
  const user = await userPublic(req.params.id);
  if (!user) return res.status(404).json({ error: 'Игрок не найден' });
  const completed = await db.all(`
    SELECT g.id, g.title, g.points, c.completed_at
    FROM completions c
    JOIN games g ON g.id=c.game_id
    WHERE c.user_id=?
    ORDER BY c.completed_at DESC
  `, req.params.id);
  const pool = await db.all(`
    SELECT g.id, g.title, g.points, g.description, p.position, p.rolled_at,
           CASE WHEN c.user_id IS NULL THEN 0 ELSE 1 END as completed
    FROM user_pools p
    JOIN games g ON g.id=p.game_id
    LEFT JOIN completions c ON c.game_id=g.id AND c.user_id=p.user_id
    WHERE p.user_id=?
    ORDER BY p.position ASC
  `, req.params.id);
  res.json({ user, completed, pool });
});

app.get('/api/leaderboard', auth, async (_, res) => {
  const users = await db.all(`SELECT id, username, nickname, role, avatar, points, completed_count FROM users ORDER BY points DESC, completed_count DESC, nickname`);
  res.json({ users });
});

app.get('/api/admin/users', auth, adminOnly, async (_, res) => {
  res.json({ users: await db.all(`SELECT id, username, nickname, role, avatar, points, completed_count, created_at FROM users ORDER BY points DESC`) });
});
app.patch('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  const { nickname, role, points, completed_count } = req.body;
  await db.run(`UPDATE users SET nickname=COALESCE(?,nickname), role=COALESCE(?,role), points=COALESCE(?,points), completed_count=COALESCE(?,completed_count) WHERE id=?`,
    nickname ?? null, role ?? null, points ?? null, completed_count ?? null, req.params.id);
  res.json({ user: await userPublic(req.params.id) });
});
app.delete('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Нельзя удалить самого себя' });
  await db.run(`DELETE FROM users WHERE id=?`, req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/games', auth, adminOnly, async (req, res) => {
  const title = String(req.body.title || '').trim();
  const points = Number(req.body.points || 0);
  const description = String(req.body.description || '').trim();
  if (!title) return res.status(400).json({ error: 'Введите название игры' });
  const r = await db.run(`INSERT INTO games(title,points,description) VALUES(?,?,?)`, title, points, description);
  res.json({ game: await db.get(`SELECT * FROM games WHERE id=?`, r.lastID) });
});
app.patch('/api/admin/games/:id', auth, adminOnly, async (req, res) => {
  const title = String(req.body.title || '').trim();
  const points = Number(req.body.points || 0);
  const description = String(req.body.description || '').trim();
  if (!title) return res.status(400).json({ error: 'Введите название игры' });
  await db.run(`UPDATE games SET title=?, points=?, description=? WHERE id=?`, title, points, description, req.params.id);
  res.json({ game: await db.get(`SELECT * FROM games WHERE id=?`, req.params.id) });
});
app.delete('/api/admin/games/:id', auth, adminOnly, async (req, res) => {
  await db.run(`DELETE FROM games WHERE id=?`, req.params.id);
  res.json({ ok: true });
});

app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

init().then(() => {
  app.listen(PORT, () => console.log(`Kekwcirclegame S2 запущен: http://localhost:${PORT}`));
}).catch(err => {
  console.error('Ошибка запуска:', err);
  process.exit(1);
});
