import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Settings } from 'lucide-react';
import { getCurrentUser } from '../App';
import '../styles/pages/aiAssistant.css';

const AIAssistant = () => {
  const user = getCurrentUser() || { name: 'User' };
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: `Hello, ${user.name}! I'm your AI safety assistant. How can I help you today?`,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const quickActions = [
    { label: 'I feel unsafe', emoji: '😟', action: 'unsafe' },
    { label: 'Share my location', emoji: '📍', action: 'location' },
    { label: 'Find nearby police', emoji: '🚔', action: 'police' },
    { label: 'Safe navigation', emoji: '🧭', action: 'navigation' },
    { label: 'Send emergency alert', emoji: '🚨', action: 'emergency' },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateAIResponse = (text) => {
    const normalized = text.trim().toLowerCase();

    if (/\b(thank|thanks|thank you)\b/.test(normalized)) {
      return 'You’re welcome! If you need anything else, I can help with location sharing, nearby police, safe routes, or sending an alert.';
    }

    if (/\b(help|unsafe|danger|emergency|alert|scared)\b/.test(normalized)) {
      return 'I understand this feels unsafe. I recommend sending an emergency alert, sharing your live location, and calling the nearest police station immediately.';
    }

    if (/\b(share|send).*location\b|\bwhere am i\b|\bmy location\b|\bcurrent location\b/.test(normalized)) {
      return 'Your live location can be shared from the Live Location page. I can also generate a direct location link for trusted contacts or emergency responders.';
    }

    if (/\b(nearest|nearby|closest).*police\b|\bpolice station\b/.test(normalized)) {
      return 'I found nearby police stations. Use the Police Stations page to view the closest station and get directions by phone or maps.';
    }

    if (/\b(safe route|route|navigation|directions|path)\b/.test(normalized)) {
      return 'I can suggest a safe route for you. Open the Safe Route page to compare safest and fastest routes with real-time directions.';
    }

    if (/\b(register|sign up|login|sign in|account)\b/.test(normalized)) {
      return 'You can register or login from the homepage. Once signed in, all safety features become available to you.';
    }

    if (/\b(calling|call police|contact police|phone police|dial police)\b/.test(normalized)) {
      return 'If you need immediate help, use the nearest police station contact on the Police Stations page or call the local emergency number right now.';
    }

    return 'I hear you. I can help with live location sharing, nearby police stations, safe routes, and emergency alerts. What would you like to do?';
  };

  const handleQuickAction = (action, label) => {
    const userMessage = {
      id: messages.length + 1,
      sender: 'user',
      text: label,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setTimeout(() => {
      let aiResponse = '';
      switch (action) {
        case 'unsafe':
          aiResponse = 'I understand you feel unsafe. I recommend sharing your live location with trusted contacts and checking nearby police station directions right away.';
          break;
        case 'location':
          aiResponse = 'Your live location is being shared with your trusted contacts. You can also copy the location link and send it manually.';
          break;
        case 'police':
          aiResponse = 'I found nearby police stations. Open the Police Stations page for the closest station and tap the call or direction button.';
          break;
        case 'navigation':
          aiResponse = 'I can guide you to the safest route. Visit the Safe Route page to compare options and start navigation.';
          break;
        case 'emergency':
          aiResponse = 'Emergency alert suggestions are ready. Use the alert and location sharing features immediately while you stay aware of your surroundings.';
          break;
        default:
          aiResponse = generateAIResponse(label);
      }

      const aiMessage = {
        id: messages.length + 2,
        sender: 'ai',
        text: aiResponse,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 500);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      sender: 'user',
      text: inputValue,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const question = inputValue;
    setInputValue('');

    setTimeout(() => {
      const aiMessage = {
        id: messages.length + 2,
        sender: 'ai',
        text: generateAIResponse(question),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 600);
  };

  return (
    <div className="ai-assistant-container">
      {/* Header */}
      <div className="ai-header">
        <div className="header-content">
          <h1>AI Safety Assistant</h1>
          <p>Your 24/7 safety companion</p>
        </div>
        <button className="settings-btn">
          <Settings size={20} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="messages-container">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.sender === 'user' ? 'user-message' : 'ai-message'}`}
          >
            {message.sender === 'ai' && <span className="ai-avatar">🤖</span>}
            <div className="message-content">
              <p>{message.text}</p>
              <span className="message-time">
                {message.timestamp.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="quick-actions-section">
          <p className="quick-actions-label">Quick Actions:</p>
          <div className="quick-actions-grid">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className="quick-action-item"
                onClick={() => handleQuickAction(action.action, action.label)}
              >
                <span className="action-emoji">{action.emoji}</span>
                <span className="action-label">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <form className="input-section" onSubmit={handleSendMessage}>
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="message-input"
          />
          <button type="button" className="voice-btn">
            <Mic size={20} />
          </button>
        </div>
        <button type="submit" className="send-btn" disabled={!inputValue.trim()}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default AIAssistant;
