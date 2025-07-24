import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import 'bootstrap/dist/css/bootstrap.min.css';

const App = () => {
  const [tickets, setTickets] = useState([]);
  const [epics, setEpics] = useState([]);
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    epic_id: '',
  });
  const [newEpic, setNewEpic] = useState('');

  useEffect(() => {
    fetch('http://localhost:3001/api/tickets')
      .then((res) => res.json())
      .then((data) => setTickets(data.tickets));
    fetch('http://localhost:3001/api/epics')
      .then((res) => res.json())
      .then((data) => setEpics(data.epics));
  }, []);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    const updatedTickets = [...tickets];
    const [movedTicket] = updatedTickets.splice(source.index, 1);
    movedTicket.status = destination.droppableId;
    updatedTickets.splice(destination.index, 0, movedTicket);
    setTickets(updatedTickets);

    fetch(`http://localhost:3001/api/tickets/${movedTicket.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: destination.droppableId }),
    });
  };

  const handleCreateTicket = () => {
    fetch('http://localhost:3001/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newTicket, status: 'ToDo' }),
    })
      .then((res) => res.json())
      .then((data) => {
        setTickets([...tickets, data]);
        setNewTicket({ title: '', description: '', priority: 'Medium', epic_id: '' });
      });
  };

  const handleCreateEpic = () => {
    fetch('http://localhost:3001/api/epics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newEpic }),
    })
      .then((res) => res.json())
      .then((data) => {
        setEpics([...epics, data]);
        setNewEpic('');
      });
  };

  const handleDeleteTicket = (ticketId) => {
    fetch(`http://localhost:3001/api/tickets/${ticketId}`, {
      method: 'DELETE',
    })
      .then((res) => {
        if (res.ok) {
          setTickets(tickets.filter((ticket) => ticket.id !== ticketId));
        }
      });
  };

  const columns = {
    ToDo: tickets.filter((t) => t.status === 'ToDo' || t.status === 'To Do'),
    InProgress: tickets.filter((t) => t.status === 'InProgress' || t.status === 'In Progress'),
    Done: tickets.filter((t) => t.status === 'Done'),
  };

  const columnTitles = {
    ToDo: 'To Do',
    InProgress: 'In Progress',
    Done: 'Done',
  };

  return (
    <div className="container mt-4">
      <h1 className="text-center mb-4">JIRA Clone</h1>
      <div className="row">
        <div className="col-md-4">
          <h2>Create Ticket</h2>
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Title"
            value={newTicket.title}
            onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
          />
          <textarea
            className="form-control mb-2"
            placeholder="Description"
            value={newTicket.description}
            onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
          />
          <select
            className="form-control mb-2"
            value={newTicket.priority}
            onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
          <select
            className="form-control mb-2"
            value={newTicket.epic_id}
            onChange={(e) => setNewTicket({ ...newTicket, epic_id: e.target.value })}
          >
            <option value="">Select Epic</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleCreateTicket}>
            Create Ticket
          </button>
        </div>
        <div className="col-md-4">
          <h2>Create Epic</h2>
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Epic Name"
            value={newEpic}
            onChange={(e) => setNewEpic(e.target.value)}
          />
          <button className="btn btn-success" onClick={handleCreateEpic}>
            Create Epic
          </button>
        </div>
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="row mt-4">
          {Object.entries(columns).map(([status, tickets]) => (
            <div key={status} className="col-md-4">
              <h2 className="text-center">{columnTitles[status]}</h2>
              <Droppable droppableId={status}>
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="p-2"
                    style={{ minHeight: '500px', backgroundColor: '#f4f5f7' }}
                  >
                    {tickets.map((ticket, index) => (
                      <Draggable key={ticket.id} draggableId={String(ticket.id)} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="card mb-2"
                          >
                            <div className="card-body">
                              <h5 className="card-title">{ticket.title}</h5>
                              <p className="card-text">{ticket.description}</p>
                              <p className="card-text">
                                <small className="text-muted">Priority: {ticket.priority}</small>
                              </p>
                              <p className="card-text">
                                <small className="text-muted">
                                  Epic: {epics.find((e) => e.id === ticket.epic_id)?.name}
                                </small>
                              </p>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTicket(ticket.id)}>Delete</button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

export default App;