const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Define your secret key
const SECRET_KEY = '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';

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/GreenerTn', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  ssl: false, // Set to false if not using SSL
});


mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

app.use(bodyParser.json());

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true }, // Ensure unique email addresses
  password: String,
  confirmationCode: String,
  username: { type: String, unique: true }, // Add a unique constraint for the username
  fullName: String,
  isVerified: Boolean, // Add a field to track verification status
});

const User = mongoose.model('User', userSchema);

// Vehicle Schema
const vehicleSchema = new mongoose.Schema({
  brand: String,
  model: String,
  yearsInUsage: Number,
  uniqueId: String,
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

// Journey Schema
const journeySchema = new mongoose.Schema({
  userId: String,
  vehicleId: String,
  miles: Number,
  date: Date,
  carbonEmission: Number,
});
const Journey = mongoose.model('Journey', journeySchema);

const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
  '707035671924-ftrenoji9k8hgq9avf0p0tsmrtltvjqe.apps.googleusercontent.com',
  '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',
  'https://developers.google.com/oauthplayground' // Redirect URL
);

oauth2Client.setCredentials({
  refresh_token: '1//04jmtqvvaBr_wCgYIARAAGAQSNwF-L9Ir3Ve6NlBmHESqU3htPi7CfFcvOTDN84EeQjVKtJa8P9cQAGDjAYIz9_4qCzAp7zly43s',
});


//Function to send confirmation email
const sendConfirmationEmail = async (to, confirmationCode) => {
  const accessToken = oauth2Client.getAccessToken();
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: 'alicecooperlovah2@gmail.com',
      clientId: '707035671924-ftrenoji9k8hgq9avf0p0tsmrtltvjqe.apps.googleusercontent.com',
      clientSecret: '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',
      refreshToken: '1//04jmtqvvaBr_wCgYIARAAGAQSNwF-L9Ir3Ve6NlBmHESqU3htPi7CfFcvOTDN84EeQjVKtJa8P9cQAGDjAYIz9_4qCzAp7zly43s',
      accessToken: accessToken,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: 'alicecooperlovah2@gmail.com',
    to: to,
    subject: 'Confirmation Email for GreenerTn',
    text: `Thank you for signing up! Please use the following code to confirm your account: ${confirmationCode}`,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) reject(err);
      resolve(info);
    });
  });
};

// Signup and issue JWT token
app.post('/signup', async (req, res) => {
  try {
    const { email, password, username, fullName } = req.body;

    // Check if the email or username is already registered
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });

    if (existingUser) {
      return res.status(400).json({ error: 'Email or username already in use.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate confirmation code
    const confirmationCode = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1d' });

    // Save user with hashed password and confirmation code
    const newUser = new User({ email, password: hashedPassword, confirmationCode, username, fullName });

    try {
      await newUser.save();
    } catch (saveError) {
      console.error('Error saving user:', saveError);
      return res.status(500).json({ error: 'Error creating user' });
    }

    // Send confirmation email
    await sendConfirmationEmail(newUser.email, confirmationCode);

   ;
    // Issue JWT token
    const token = jwt.sign({ email: newUser.email }, SECRET_KEY, { expiresIn: '1d' });

    // Customize the response with additional information
    res.status(201).json({
      message: 'User created successfully. Check your email for confirmation.',
      userId: newUser._id,
      email: newUser.email,
      username: newUser.username,
      fullName: newUser.fullName,
      token,
    });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(400).json({ error: error.message });
  }
});





// Confirm user account
app.post('/confirm', async (req, res) => {
  try {
    const { confirmationCode } = req.body;
    const decoded = jwt.verify(confirmationCode, SECRET_KEY);
    const email = decoded.email;

    const user = await User.findOneAndUpdate({ email }, { isVerified: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(200).json({ message: 'Account confirmed successfully.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login and issue JWT token
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists and is verified
    const user = await User.findOne({ email, isVerified: true });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or account not verified.' });
    }

    // Check hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);


    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    // Issue JWT token
    const token = jwt.sign({ email: user.email }, SECRET_KEY, { expiresIn: '1d' });

    res.status(200).json({ token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Token not provided.' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// Apply the middleware to routes that require authentication
app.use('/user/:userId', verifyToken);
app.use('/vehicle', verifyToken);
app.use('/journey', verifyToken);

// Now, only users with a valid token can access these routes

app.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.status(200).json(user);
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});
// Update user by ID
app.put('/user/:userId', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.userId, req.body, { new: true });
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});

// Delete user by ID
app.delete('/user/:userId', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.userId);
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});






// CRUD operations for Vehicle
app.post('/vehicle', async (req, res) => {
    try {
      const newVehicle = new Vehicle(req.body);
      await newVehicle.save();
      res.status(201).json(newVehicle);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.get('/vehicle/:vehicleId', async (req, res) => {
    try {
      const vehicle = await Vehicle.findById(req.params.vehicleId);
      res.status(200).json(vehicle);
    } catch (error) {
      res.status(404).json({ error: 'Vehicle not found' });
    }
  });
 

// Delete vehicle by ID
app.delete('/vehicle/:vehicleId', async (req, res) => {
  try {
    await Vehicle.findByIdAndDelete(req.params.vehicleId);
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Vehicle not found' });
  }
});

// Get all vehicles
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find();
    res.status(200).json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Function to send email notification

 // CRUD operations for Journey
 app.post('/journey', async (req, res) => {
  try {
    const { userId, vehicleId, miles, date } = req.body;

    // Assuming you have a function to calculate carbon emission based on the provided formula
    const carbonEmission = calculateCarbonEmission(miles);

    const newJourney = new Journey({ userId, vehicleId, miles, date, carbonEmission });
    await newJourney.save();

    res.status(201).json(newJourney);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/journey/:journeyId', async (req, res) => {
  try {
    const journey = await Journey.findById(req.params.journeyId);
    res.status(200).json(journey);
  } catch (error) {
    res.status(404).json({ error: 'Journey not found' });
  }
});
// Function to calculate carbon emission based on the provided formula
function calculateCarbonEmission(miles) {
  // Assuming the formula: 35 miles/gallon and 8.8 kg CO2 is produced using each US gallon of fuel
  const emissionPerGallon = 8.8; // in kg
  const mileage = 35; // in miles/gallon

  const gallonsUsed = miles / mileage;
  const carbonEmission = gallonsUsed * emissionPerGallon;

  return carbonEmission;
}
// EcoSuggestions
app.get('/suggest/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    const averageEmission = await Journey.aggregate([
      { $match: { userId: req.params.userId } },
      { $group: { _id: null, avgEmission: { $avg: '$carbonEmission' } } },
    ]);

    const message = `Consider alternating between using your car and going for public transportation. This is based on your average carbon emission ${averageEmission[0].avgEmission} kg.`;

   
 

    // You can implement your suggestion logic here based on averageEmission
    res.status(200).json({ suggestion: message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


    

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
