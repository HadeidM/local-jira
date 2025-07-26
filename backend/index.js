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
    CREATE TABLE IF NOT EXISTS sprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      goal TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      sprint_id INTEGER,
      priority_color TEXT,
      story_points INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (epic_id) REFERENCES epics (id),
      FOREIGN KEY (sprint_id) REFERENCES sprints (id)
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

app.get('/api/sprints', (req, res) => {
  db.all('SELECT * FROM sprints ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ sprints: rows });
  });
});

app.post('/api/sprints', (req, res) => {
  const { name, start_date, end_date, goal } = req.body;
  if (!name || !start_date || !end_date) {
    return res.status(400).json({ error: 'Name, start date, and end date are required' });
  }
  
  db.run('INSERT INTO sprints (name, start_date, end_date, goal) VALUES (?, ?, ?, ?)', 
    [name, start_date, end_date, goal || null], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, start_date, end_date, goal, status: 'active' });
  });
});

app.put('/api/sprints/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  db.run('UPDATE sprints SET status = ? WHERE id = ?', [status, req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Sprint status updated successfully' });
  });
});

app.delete('/api/sprints/:id', (req, res) => {
  // First, remove sprint_id from all tickets in this sprint
  db.run('UPDATE tickets SET sprint_id = NULL WHERE sprint_id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Then delete the sprint
    db.run('DELETE FROM sprints WHERE id = ?', [req.params.id], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Sprint deleted successfully', changes: this.changes });
    });
  });
});

// Analytics endpoints
app.get('/api/analytics/sprint/:id/burndown', (req, res) => {
  const sprintId = req.params.id;
  
  // Get sprint details
  db.get('SELECT * FROM sprints WHERE id = ?', [sprintId], (err, sprint) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!sprint) {
      res.status(404).json({ error: 'Sprint not found' });
      return;
    }

    // Get tickets in this sprint with their status changes over time
    db.all(`
      SELECT 
        tickets.id,
        tickets.title,
        tickets.story_points,
        tickets.status,
        tickets.created_at,
        tickets.updated_at
      FROM tickets 
      WHERE sprint_id = ?
      ORDER BY created_at
    `, [sprintId], (err, tickets) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const totalStoryPoints = tickets.reduce((sum, ticket) => sum + (ticket.story_points || 0), 0);
      const completedStoryPoints = tickets
        .filter(ticket => ticket.status === 'Done')
        .reduce((sum, ticket) => sum + (ticket.story_points || 0), 0);

      const burndownData = {
        sprint: sprint,
        totalStoryPoints,
        completedStoryPoints,
        remainingStoryPoints: totalStoryPoints - completedStoryPoints,
        totalTickets: tickets.length,
        completedTickets: tickets.filter(t => t.status === 'Done').length,
        tickets
      };

      res.json(burndownData);
    });
  });
});

app.get('/api/analytics/velocity', (req, res) => {
  // Get velocity data from completed sprints
  db.all(`
    SELECT 
      s.id,
      s.name,
      s.start_date,
      s.end_date,
      s.status,
      COUNT(t.id) as total_tickets,
      SUM(t.story_points) as total_story_points,
      COUNT(CASE WHEN t.status = 'Done' THEN 1 END) as completed_tickets,
      SUM(CASE WHEN t.status = 'Done' THEN t.story_points ELSE 0 END) as completed_story_points
    FROM sprints s
    LEFT JOIN tickets t ON s.id = t.sprint_id
    WHERE s.status = 'completed'
    GROUP BY s.id
    ORDER BY s.end_date DESC
    LIMIT 10
  `, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const velocityData = {
      sprints: rows,
      averageVelocity: rows.length > 0 ? 
        rows.reduce((sum, sprint) => sum + (sprint.completed_story_points || 0), 0) / rows.length : 0,
      totalCompletedStoryPoints: rows.reduce((sum, sprint) => sum + (sprint.completed_story_points || 0), 0)
    };

    res.json(velocityData);
  });
});

app.get('/api/analytics/overview', (req, res) => {
  // Get overall project analytics
  db.all(`
    SELECT 
      COUNT(*) as total_tickets,
      SUM(story_points) as total_story_points,
      COUNT(CASE WHEN status = 'Done' THEN 1 END) as completed_tickets,
      SUM(CASE WHEN status = 'Done' THEN story_points ELSE 0 END) as completed_story_points,
      COUNT(CASE WHEN status = 'ToDo' OR status = 'To Do' THEN 1 END) as todo_tickets,
      COUNT(CASE WHEN status = 'InProgress' OR status = 'In Progress' THEN 1 END) as in_progress_tickets
    FROM tickets
  `, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const stats = rows[0];
    const completionRate = stats.total_story_points > 0 ? 
      (stats.completed_story_points / stats.total_story_points * 100).toFixed(1) : 0;

    const overviewData = {
      totalTickets: stats.total_tickets,
      totalStoryPoints: stats.total_story_points || 0,
      completedTickets: stats.completed_tickets,
      completedStoryPoints: stats.completed_story_points || 0,
      todoTickets: stats.todo_tickets,
      inProgressTickets: stats.in_progress_tickets,
      completionRate: parseFloat(completionRate)
    };

    res.json(overviewData);
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
      epics.color AS epic_color,
      sprints.name AS sprint_name,
      sprints.status AS sprint_status
    FROM tickets
    LEFT JOIN epics ON tickets.epic_id = epics.id
    LEFT JOIN sprints ON tickets.sprint_id = sprints.id
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
  const { title, description, status, priority, epic_id, sprint_id, priority_color, story_points } = req.body;
  if (!title || !status || !priority) {
    console.log('Validation failed: missing required fields');
    return res.status(400).json({ error: 'Title, status, and priority are required' });
  }
  const actualEpicId = epic_id || null; // Convert empty string to null for database
  const actualSprintId = sprint_id || null; // Convert empty string to null for database
  const actualStoryPoints = story_points || null;
  console.log('Inserting ticket with values:', [title, description, status, priority, actualEpicId, actualSprintId, priority_color, actualStoryPoints]);

  db.run(
    'INSERT INTO tickets (title, description, status, priority, epic_id, sprint_id, priority_color, story_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [title, description, status, priority, actualEpicId, actualSprintId, priority_color, actualStoryPoints],
    function (err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log('Ticket created successfully with ID:', this.lastID);
      const newTicketId = this.lastID;
      
      // Fetch both epic and sprint information
      const getEpicInfo = (callback) => {
        if (actualEpicId) {
          db.get('SELECT name as epic_name, color as epic_color FROM epics WHERE id = ?', [actualEpicId], (err, epicRow) => {
            if (err) {
              console.error('Error fetching epic:', err);
              res.status(500).json({ error: err.message });
              return;
            }
            callback(epicRow);
          });
        } else {
          callback(null);
        }
      };

      const getSprintInfo = (epicRow, callback) => {
        if (actualSprintId) {
          db.get('SELECT name as sprint_name, status as sprint_status FROM sprints WHERE id = ?', [actualSprintId], (err, sprintRow) => {
            if (err) {
              console.error('Error fetching sprint:', err);
              res.status(500).json({ error: err.message });
              return;
            }
            callback(epicRow, sprintRow);
          });
        } else {
          callback(epicRow, null);
        }
      };

      getEpicInfo((epicRow) => {
        getSprintInfo(epicRow, (epicRow, sprintRow) => {
          const response = { 
            id: newTicketId, 
            title, 
            description, 
            status, 
            priority, 
            epic_id: actualEpicId, 
            sprint_id: actualSprintId,
            priority_color, 
            epic_name: epicRow ? epicRow.epic_name : null, 
            epic_color: epicRow ? epicRow.epic_color : null,
            sprint_name: sprintRow ? sprintRow.sprint_name : null,
            sprint_status: sprintRow ? sprintRow.sprint_status : null,
            story_points: actualStoryPoints 
          };
          console.log('Sending response:', response);
          res.json(response);
        });
      });
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