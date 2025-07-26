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
      name TEXT NOT NULL,
      color TEXT
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
      priority_color TEXT,
      story_points INTEGER,
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

const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

app.post('/api/epics', (req, res) => {
  const { name, color } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Epic name is required' });
  }
  const epicColor = color || getRandomColor();
  db.run('INSERT INTO epics (name, color) VALUES (?, ?)', [name, epicColor], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, color: epicColor });
  });
});

app.get('/api/tickets', (req, res) => {
  db.all(`
    SELECT
      tickets.*,
      epics.name AS epic_name,
      epics.color AS epic_color
    FROM tickets
    LEFT JOIN epics ON tickets.epic_id = epics.id
  `, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ tickets: rows });
  });
});

app.post('/api/tickets', (req, res) => {
  console.log('Received ticket creation request:', req.body);
  const { title, description, status, priority, epic_id, priority_color, story_points } = req.body;
  if (!title || !status || !priority) {
    console.log('Validation failed: missing required fields');
    return res.status(400).json({ error: 'Title, status, and priority are required' });
  }
  const actualEpicId = epic_id || null; // Convert empty string to null for database
  const actualStoryPoints = story_points || null;
  console.log('Inserting ticket with values:', [title, description, status, priority, actualEpicId, priority_color, actualStoryPoints]);

  db.run(
    'INSERT INTO tickets (title, description, status, priority, epic_id, priority_color, story_points) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, description, status, priority, actualEpicId, priority_color, actualStoryPoints],
    function (err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log('Ticket created successfully with ID:', this.lastID);
      const newTicketId = this.lastID;
      if (actualEpicId) {
        db.get('SELECT name as epic_name, color as epic_color FROM epics WHERE id = ?', [actualEpicId], (err, epicRow) => {
          if (err) {
            console.error('Error fetching epic:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          const response = { id: newTicketId, title, description, status, priority, epic_id: actualEpicId, priority_color, epic_name: epicRow ? epicRow.epic_name : null, epic_color: epicRow ? epicRow.epic_color : null, story_points: actualStoryPoints };
          console.log('Sending response:', response);
          res.json(response);
        });
      } else {
        const response = { id: newTicketId, title, description, status, priority, epic_id: actualEpicId, priority_color, epic_name: null, epic_color: null, story_points: actualStoryPoints };
        console.log('Sending response:', response);
        res.json(response);
      }
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

app.delete('/api/epics/:id', (req, res) => {
  // First, update all tickets that reference this epic to remove the epic_id
  db.run('UPDATE tickets SET epic_id = NULL WHERE epic_id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Then delete the epic
    db.run('DELETE FROM epics WHERE id = ?', [req.params.id], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Epic deleted successfully', changes: this.changes });
    });
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;