import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Phone, MessageCircle } from 'lucide-react';
import { emergencyContacts } from '../App';
import '../styles/pages/emergencyContacts.css';

const EmergencyContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    role: 'Secondary',
  });

  useEffect(() => {
    const savedContacts = localStorage.getItem('emergencyContacts');
    if (savedContacts) {
      setContacts(JSON.parse(savedContacts));
    } else {
      setContacts(emergencyContacts);
      localStorage.setItem('emergencyContacts', JSON.stringify(emergencyContacts));
    }
  }, []);

  const saveContacts = (updatedContacts) => {
    setContacts(updatedContacts);
    localStorage.setItem('emergencyContacts', JSON.stringify(updatedContacts));
  };

  const handleAddContact = (e) => {
    e.preventDefault();
    if (!newContact.name || !newContact.phone) return;

    const contact = {
      id: Date.now(),
      ...newContact,
      avatar: '👤',
    };
    const updatedContacts = [...contacts, contact];
    saveContacts(updatedContacts);
    setNewContact({ name: '', phone: '', role: 'Secondary' });
    setShowAddForm(false);
  };

  const handleDeleteContact = (id) => {
    const updatedContacts = contacts.filter((c) => c.id !== id);
    saveContacts(updatedContacts);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Primary':
        return 'primary';
      case 'Secondary':
        return 'secondary';
      case 'Emergency':
        return 'emergency';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="emergency-contacts-container">
      <div className="contacts-header">
        <h1>Emergency Contacts</h1>
        <button className="add-contact-btn" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={20} />
          <span>Add Contact</span>
        </button>
      </div>

      {showAddForm && (
        <form className="add-contact-form" onSubmit={handleAddContact}>
          <div className="form-group">
            <label>Contact Name</label>
            <input
              type="text"
              placeholder="Enter contact name"
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              placeholder="Enter phone number"
              value={newContact.phone}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select
              value={newContact.role}
              onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
            >
              <option>Primary</option>
              <option>Secondary</option>
              <option>Emergency</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-save">Save Contact</button>
            <button type="button" className="btn-cancel" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="contacts-list">
        {contacts.length === 0 ? (
          <div className="empty-state">
            <p>No emergency contacts added yet</p>
            <p className="empty-description">Add your first contact to get started</p>
          </div>
        ) : (
          contacts.map((contact) => (
            <div key={contact.id} className={`contact-card ${getRoleColor(contact.role)}`}>
              <div className="contact-avatar">{contact.avatar}</div>
              <div className="contact-details">
                <h3>{contact.name}</h3>
                <p className="phone">{contact.phone}</p>
                <span className={`role-badge ${getRoleColor(contact.role)}`}>
                  {contact.role}
                </span>
              </div>
              <div className="contact-actions">
                <button className="action-btn call" title="Call">
                  <Phone size={18} />
                </button>
                <button className="action-btn sms" title="SMS">
                  <MessageCircle size={18} />
                </button>
                <button className="action-btn edit" title="Edit">
                  <Edit2 size={18} />
                </button>
                <button
                  className="action-btn delete"
                  title="Delete"
                  onClick={() => handleDeleteContact(contact.id)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EmergencyContacts;

