const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

async function register(req, res) {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO players (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [username, email, passwordHash]
    );
    const playerId = result[0].id;
    await query(
      'INSERT INTO player_resources (player_id) VALUES ($1)',
      [playerId]
    );
    return res.status(201).json({ message: 'registered' });
  } catch (err) {
    if (err.message && err.message.includes('unique')) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const rows = await query('SELECT * FROM players WHERE email = $1', [email]);
    const player = rows[0];
    if (!player) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, player.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ playerId: player.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed' });
  }
}

async function me(req, res) {
  try {
    const rows = await query(
      'SELECT id, username, email, created_at FROM players WHERE id = $1',
      [req.player.id]
    );
    const player = rows[0];
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    return res.json(player);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch player' });
  }
}

module.exports = { register, login, me };
