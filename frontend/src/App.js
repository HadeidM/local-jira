import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import 'bootstrap/dist/css/bootstrap.min.css';

const App = () => {
  const [tickets, setTickets] = useState([]);
  const [epics, setEpics] = useState([]);
  const [fadingTickets, setFadingTickets] = useState([]);
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    epic_id: '',
    story_points: '',
  });
  const [newEpic, setNewEpic] = useState({ name: '', color: '#007bff' });
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showEpicModal, setShowEpicModal] = useState(false);
  const [epicsCollapsed, setEpicsCollapsed] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3001/api/tickets')
      .then((res) => res.json())
      .then((data) => {
        // Ensure epic_id is properly converted to number for all tickets
        const ticketsWithCorrectEpicId = data.tickets.map(ticket => ({
          ...ticket,
          epic_id: ticket.epic_id ? parseInt(ticket.epic_id) : null
        }));
        setTickets(ticketsWithCorrectEpicId);
      });
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
    }).then(() => {
      if (destination.droppableId === 'Done') {
        setFadingTickets((prev) => prev.includes(movedTicket.id) ? prev : [...prev, movedTicket.id]);
      }
    });
  };

  useEffect(() => {
    if (fadingTickets.length === 0) return;
    fadingTickets.forEach((ticketId) => {
      const timeout = setTimeout(() => {
        handleDeleteTicket(ticketId);
        setFadingTickets((prev) => prev.filter((id) => id !== ticketId));
      }, 2000);
      return () => clearTimeout(timeout);
    });
    // eslint-disable-next-line
  }, [fadingTickets]);

  const priorityColors = {
    Low: '#28a745',
    Medium: '#ffc107',
    High: '#dc3545',
  };

  const handleCreateTicket = () => {
    const priorityColor = priorityColors[newTicket.priority];
    console.log('Creating ticket with data:', { ...newTicket, status: 'ToDo', priority_color: priorityColor });
    
    fetch('http://localhost:3001/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newTicket, status: 'ToDo', priority_color: priorityColor }),
    })
      .then((res) => {
        console.log('Response status:', res.status);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log('Created ticket:', data);
        // Ensure the ticket has the correct epic_id format (number or null)
        const ticketWithCorrectEpicId = {
          ...data,
          epic_id: data.epic_id ? parseInt(data.epic_id) : null
        };
        setTickets([...tickets, ticketWithCorrectEpicId]);
        setNewTicket({ title: '', description: '', priority: 'Medium', epic_id: '', story_points: '' });
        setShowTicketModal(false); // Close modal after creation
      })
      .catch((error) => {
        console.error('Error creating ticket:', error);
        alert('Failed to create ticket. Please try again.');
      });
  };

  const handleCreateEpic = () => {
    fetch('http://localhost:3001/api/epics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEpic),
    })
      .then((res) => res.json())
      .then((data) => {
        setEpics([...epics, data]);
        setNewEpic({ name: '', color: '#007bff' });
        setShowEpicModal(false); // Close modal after creation
      });
  };

  const handleDeleteTicket = (ticketId) => {
    // Prevent double deletion
    if (!tickets.some((ticket) => ticket.id === ticketId)) return;
    fetch(`http://localhost:3001/api/tickets/${ticketId}`, {
      method: 'DELETE',
    })
      .then((res) => {
        if (res.ok) {
          setTickets((tickets) => tickets.filter((ticket) => ticket.id !== ticketId));
        }
      });
  };

  const handleDeleteEpic = (epicId) => {
    console.log('Attempting to delete epic:', epicId);
    fetch(`http://localhost:3001/api/epics/${epicId}`, {
      method: 'DELETE',
    })
      .then((res) => {
        console.log('Delete epic response status:', res.status);
        if (res.ok) {
          console.log('Epic deleted successfully');
          setEpics((epics) => epics.filter((epic) => epic.id !== epicId));
          // Also remove tickets associated with the deleted epic
          setTickets((tickets) => tickets.filter((ticket) => parseInt(ticket.epic_id) !== epicId));
        } else {
          console.error('Failed to delete epic:', res.status);
        }
      })
      .catch((error) => {
        console.error('Error deleting epic:', error);
      });
  };

  const columns = {
    ToDo: tickets.filter((t) => {
      const matches = t.status === 'ToDo' || t.status === 'To Do';
      if (t.status === 'ToDo' || t.status === 'To Do') {
        console.log('Ticket in ToDo:', t);
      }
      return matches;
    }),
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
      <div className="row mb-4">
        <div className="col-md-6">
          <button className="btn btn-primary" onClick={() => setShowTicketModal(true)}>
            <i className="bi bi-plus-lg"></i> Create Ticket
          </button>
        </div>
        <div className="col-md-6 text-end">
          <button className="btn btn-success" onClick={() => setShowEpicModal(true)}>
            <i className="bi bi-plus-lg"></i> Create Epic
          </button>
        </div>
      </div>

      {/* Ticket Creation Modal */}
      {showTicketModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create New Ticket</h5>
                <button type="button" className="btn-close" onClick={() => setShowTicketModal(false)}></button>
              </div>
              <div className="modal-body">
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
                <input
                  type="number"
                  className="form-control mb-2"
                  placeholder="Story Points (optional)"
                  value={newTicket.story_points}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Only allow integers (no decimals, no negative numbers)
                    if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 1 && parseInt(value) <= 100)) {
                      setNewTicket({ ...newTicket, story_points: value });
                    }
                  }}
                  min="1"
                  max="100"
                  step="1"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTicketModal(false)}>Close</button>
                <button type="button" className="btn btn-primary" onClick={handleCreateTicket}>Create Ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Epic Creation Modal */}
      {showEpicModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create New Epic</h5>
                <button type="button" className="btn-close" onClick={() => setShowEpicModal(false)}></button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control mb-2"
                  placeholder="Epic Name"
                  value={newEpic.name}
                  onChange={(e) => setNewEpic({ ...newEpic, name: e.target.value })}
                />
                <input
                  type="color"
                  className="form-control mb-2"
                  value={newEpic.color}
                  onChange={(e) => setNewEpic({ ...newEpic, color: e.target.value })}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEpicModal(false)}>Close</button>
                <button type="button" className="btn btn-success" onClick={handleCreateEpic}>Create Epic</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Epic Display Section */}
      {epics.length > 0 && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Epics</h5>
                  <button 
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setEpicsCollapsed(!epicsCollapsed)}
                  >
                    <i className={`bi bi-chevron-${epicsCollapsed ? 'down' : 'up'}`}></i>
                    {epicsCollapsed ? 'Show' : 'Hide'}
                  </button>
                </div>
              </div>
              {!epicsCollapsed && (
                <div className="card-body">
                  <div className="row">
                    {epics.map((epic) => (
                      <div key={epic.id} className="col-md-3 col-sm-6 mb-3">
                        <div 
                          className="card h-100"
                          style={{ 
                            border: '1px solid #dee2e6',
                            borderLeft: `4px solid ${epic.color}`
                          }}
                        >
                          <div className="card-body">
                            <h6 className="card-title">{epic.name}</h6>
                            <div className="d-flex justify-content-between align-items-center">
                              <span 
                                className="badge"
                                style={{ 
                                  backgroundColor: epic.color,
                                  color: 'white'
                                }}
                              >
                                {tickets.filter(ticket => parseInt(ticket.epic_id) === epic.id).length} tickets
                              </span>
                              <div className="btn-group btn-group-sm">
                                <button 
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleDeleteEpic(epic.id)}
                                  title="Delete Epic"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                            className="card"
                            style={{
                              ...provided.draggableProps.style,
                              marginBottom: '8px',
                              opacity: status === 'Done' && fadingTickets.includes(ticket.id) ? 0 : 1,
                              transition: status === 'Done' && fadingTickets.includes(ticket.id) ? 'opacity 2s ease' : undefined,
                            }}
                          >
                            <div className="card-body" style={{ position: 'relative' }}>
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <h5 className="card-title mb-0" style={{ textDecoration: fadingTickets.includes(ticket.id) ? 'line-through' : 'none', flex: '1', marginRight: '10px' }}>{ticket.title}</h5>
                                <div className="d-flex align-items-center gap-1" style={{ flexShrink: 0 }}>
                                  {ticket.priority === 'Low' && <i className="bi bi-arrow-down-circle-fill text-success" title="Low Priority" style={{ cursor: 'default', fontSize: '1.1em' }}></i>}
                                  {ticket.priority === 'Medium' && <i className="bi bi-dash-circle-fill text-warning" title="Medium Priority" style={{ cursor: 'default', fontSize: '1.1em' }}></i>}
                                  {ticket.priority === 'High' && <i className="bi bi-arrow-up-circle-fill text-danger" title="High Priority" style={{ cursor: 'default', fontSize: '1.1em' }}></i>}
                                  {ticket.story_points && (
                                    <span
                                      style={{
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        padding: '3px 8px',
                                        borderRadius: '12px',
                                        fontSize: '0.75em',
                                        fontWeight: 'bold',
                                        minWidth: '20px',
                                        textAlign: 'center',
                                      }}
                                      title={`${ticket.story_points} story points`}
                                    >
                                      {ticket.story_points}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="card-text">{ticket.description}</p>
                              {ticket.epic_name && (
                                <div
                                  style={{
                                    backgroundColor: ticket.epic_color,
                                    padding: '5px',
                                    borderRadius: '3px',
                                    marginTop: '10px',
                                    color: 'white',
                                    fontSize: '0.8em',
                                    fontWeight: 'bold',
                                    display: 'inline-block',
                                  }}
                                >
                                  {ticket.epic_name}
                                </div>
                              )}
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