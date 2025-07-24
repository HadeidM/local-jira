const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const port = 3001;

app.use(express.json());
app.use(cors());

const db = new sqlite3.Database('./jira.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the JIRA database.');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS epics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      epic_id INTEGER,
      FOREIGN KEY (epic_id) REFERENCES epics (id)
    )
  `);
});

app.get('/api/epics', (req, res) => {
  db.all('SELECT * FROM epics', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ epics: rows });
  });
});

app.post('/api/epics', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Epic name is required' });
  }
  db.run('INSERT INTO epics (name) VALUES (?)', [name], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name });
  });
});

app.get('/api/tickets', (req, res) => {
  db.all('SELECT * FROM tickets', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ tickets: rows });
  });
});

app.post('/api/tickets', (req, res) => {
  const { title, description, status, priority, epic_id } = req.body;
  if (!title || !status || !priority) {
    return res.status(400).json({ error: 'Title, status, and priority are required' });
  }
  db.run(
    'INSERT INTO tickets (title, description, status, priority, epic_id) VALUES (?, ?, ?, ?, ?)',
    [title, description, status, priority, epic_id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, title, description, status, priority, epic_id });
    }
  );
});

app.put('/api/tickets/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  db.run(
    'UPDATE tickets SET status = ? WHERE id = ?',
    [status, req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Ticket status updated successfully' });
    }
  );
});

app.delete('/api/tickets/:id', (req, res) => {
  db.run('DELETE FROM tickets WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Ticket deleted successfully', changes: this.changes });
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});