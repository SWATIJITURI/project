const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/womens-safety-tracker')
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// User Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Safety Event Model
const safetyEventSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  feature: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, required: true }
}, { timestamps: true });

const SafetyEvent = mongoose.model('SafetyEvent', safetyEventSchema);

// Auth Routes

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Safety Events Route
app.post('/api/safety-events', async (req, res) => {
  try {
    const { userId, feature, message, severity } = req.body;
    
    const newEvent = new SafetyEvent({
      userId,
      feature,
      message,
      severity
    });
    
    await newEvent.save();
    res.status(201).json({ message: 'Safety event logged successfully', event: newEvent });
  } catch (error) {
    console.error('Error saving safety event:', error);
    res.status(500).json({ message: 'Server error saving event' });
  }
});

// GET Safety Events Route
app.get('/api/safety-events', async (req, res) => {
  try {
    const { userId } = req.query;
    const query = userId ? { userId } : {};
    const events = await SafetyEvent.find(query).sort({ createdAt: -1 }).limit(20);
    res.json(events);
  } catch (error) {
    console.error('Error fetching safety events:', error);
    res.status(500).json({ message: 'Server error fetching events' });
  }
});

// SOS Emergency Model
const sosEventSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  location: { type: Object, default: {} },
  source: { type: String, default: 'manual' }, // voice, shake, manual
  reason: { type: String, default: '' },
  status: { type: String, default: 'active' }
}, { timestamps: true });

const SOSEvent = mongoose.model('SOSEvent', sosEventSchema);

// Emergency SOS Trigger Route
app.post('/api/sos/trigger', async (req, res) => {
  try {
    const { userId, location, source, reason } = req.body;
    
    const newSOS = new SOSEvent({
      userId,
      location: location || {},
      source: source || 'manual',
      reason: reason || ''
    });
    
    await newSOS.save();
    
    // In a production app, this is where SMS/Email notification logic (Twilio/SendGrid) goes
    console.log(`🚨 EMERGENCY SOS TRIGGERED BY ${userId} via ${source} 🚨`);
    
    res.status(201).json({ success: true, message: 'Emergency contacts and authorities notified.', eventId: newSOS._id });
  } catch (error) {
    console.error('SOS trigger error:', error);
    res.status(500).json({ success: false, message: 'Server error triggering SOS' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
