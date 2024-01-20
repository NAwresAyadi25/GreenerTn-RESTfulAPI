const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const { google } = require('googleapis');
const swaggerJSDoc= require('swagger-jsdoc');
const swaggerUi= require('swagger-ui-express');
const app = express();
const PORT = process.env.PORT || 3000;
 
const  options = {
  definition: {
    openapi:'3.0.0',
    info: {
      title: 'GreenerTn API',
      version: '1.0.0',
     
      },
      servers: [
        {url: 'http://localhost:3000/' }] 
    
    },
    apis: ['app.js']
  }
   

const swaggerSpec= swaggerJSDoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Define your secret key
const SECRET_KEY = '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';

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/GreenerTn', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  ssl: false,  
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
  isVerified: Boolean, //  field to track verification status
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
/**
 * @swagger
 * /signup:
 *   post:
 *     summary: Create a new user
 *     description: Endpoint to sign up and issue JWT token
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               username:
 *                 type: string
 *               fullName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully. Check your email for confirmation.
 *         content:
 *           application/json:
 *             example:
 *               message: User created successfully. Check your email for confirmation.
 *               userId: <user_id>
 *               email: <user_email>
 *               username: <user_username>
 *               fullName: <user_fullName>
 *               token: <user_token>
 *       400:
 *         description: Error creating user
 *         content:
 *           application/json:
 *             example:
 *               error: Error creating user
 */
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



/**
 * @swagger
 * /confirm:
 *   post:
 *     summary: Confirm user account
 *     description: Endpoint to confirm user account
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confirmationCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account confirmed successfully.
 *         content:
 *           application/json:
 *             example:
 *               message: Account confirmed successfully.
 *       400:
 *         description: Invalid token.
 *         content:
 *           application/json:
 *             example:
 *               error: Invalid token.
 */


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
/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login and issue JWT token
 *     description: Endpoint for user login
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User logged in successfully.
 *         content:
 *           application/json:
 *             example:
 *               token: <user_token>
 *       401:
 *         description: Invalid email or account not verified.
 *         content:
 *           application/json:
 *             example:
 *               error: Invalid email or account not verified.
 */

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
/**
 * @swagger
 * /user/{userId}:
 *   get:
 *     summary: Get user by ID
 *     description: Endpoint to get user by ID
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details retrieved successfully.
 *         content:
 *           application/json:
 *             example:
 *               _id: <user_id>
 *               email: <user_email>
 *               username: <user_username>
 *               fullName: <user_fullName>
 *               isVerified: <user_isVerified>
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             example:
 *               error: User not found.
 */
app.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.status(200).json(user);
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});
/**
 * @swagger
 * /user/{userId}:
 *   put:
 *     summary: Update user by ID
 *     description: Endpoint to update user details by ID
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               username:
 *                 type: string
 *               fullName:
 *                 type: string
 *               isVerified:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User details updated successfully.
 *         content:
 *           application/json:
 *             example:
 *               _id: <user_id>
 *               email: <user_email>
 *               username: <user_username>
 *               fullName: <user_fullName>
 *               isVerified: <user_isVerified>
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             example:
 *               error: User not found.
 */

// Update user by ID
app.put('/user/:userId', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.userId, req.body, { new: true });
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});
/**
 * @swagger
 * /user/{userId}:
 *   delete:
 *     summary: Delete user by ID
 *     description: Endpoint to delete a user by ID
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: User deleted successfully.
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             example:
 *               error: User not found.
 */

// Delete user by ID
app.delete('/user/:userId', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.userId);
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});




/**
 * @swagger
 * /vehicle:
 *   post:
 *     summary: Create a new vehicle
 *     description: Endpoint to create a new vehicle
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               brand:
 *                 type: string
 *               model:
 *                 type: string
 *               yearsInUsage:
 *                 type: number
 *               uniqueId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Vehicle created successfully.
 *         content:
 *           application/json:
 *             example:
 *               _id: <vehicle_id>
 *               brand: <vehicle_brand>
 *               model: <vehicle_model>
 *               yearsInUsage: <vehicle_yearsInUsage>
 *               uniqueId: <vehicle_uniqueId>
 *       400:
 *         description: Error creating vehicle.
 *         content:
 *           application/json:
 *             example:
 *               error: Error creating vehicle.
 */


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
  /**
 * @swagger
 * /vehicle/{vehicleId}:
 *   get:
 *     summary: Get vehicle by ID
 *     description: Endpoint to get vehicle by ID
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vehicle details retrieved successfully.
 *         content:
 *           application/json:
 *             example:
 *               _id: <vehicle_id>
 *               brand: <vehicle_brand>
 *               model: <vehicle_model>
 *               yearsInUsage: <vehicle_yearsInUsage>
 *               uniqueId: <vehicle_uniqueId>
 *       404:
 *         description: Vehicle not found.
 *         content:
 *           application/json:
 *             example:
 *               error: Vehicle not found.
 */

  app.get('/vehicle/:vehicleId', async (req, res) => {
    try {
      const vehicle = await Vehicle.findById(req.params.vehicleId);
      res.status(200).json(vehicle);
    } catch (error) {
      res.status(404).json({ error: 'Vehicle not found' });
    }
  });
 
/**
 * @swagger
 * /vehicle/{vehicleId}:
 *   delete:
 *     summary: Delete vehicle by ID
 *     description: Endpoint to delete vehicle by ID
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Vehicle deleted successfully.
 *       404:
 *         description: Vehicle not found.
 *         content:
 *           application/json:
 *             example:
 *               error: Vehicle not found.
 */

// Delete vehicle by ID
app.delete('/vehicle/:vehicleId', async (req, res) => {
  try {
    await Vehicle.findByIdAndDelete(req.params.vehicleId);
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Vehicle not found' });
  }
});
/**
 * @swagger
 * /vehicles:
 *   get:
 *     summary: Get all vehicles
 *     description: Endpoint to get all vehicles
 *     responses:
 *       200:
 *         description: Vehicles retrieved successfully.
 *         content:
 *           application/json:
 *             example:
 *               - _id: <vehicle_id_1>
 *                 brand: <vehicle_brand_1>
 *                 model: <vehicle_model_1>
 *                 yearsInUsage: <vehicle_yearsInUsage_1>
 *                 uniqueId: <vehicle_uniqueId_1>
 *               - _id: <vehicle_id_2>
 *                 brand: <vehicle_brand_2>
 *                 model: <vehicle_model_2>
 *                 yearsInUsage: <vehicle_yearsInUsage_2>
 *                 uniqueId: <vehicle_uniqueId_2>
 *               ...
 *       500:
 *         description: Internal Server Error.
 *         content:
 *           application/json:
 *             example:
 *               error: Internal Server Error.
 */

// Get all vehicles
app.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find();
    res.status(200).json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
 
/**
 * @swagger
 * /journey:
 *   post:
 *     summary: Record a new journey
 *     description: Endpoint to record a new journey
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               vehicleId:
 *                 type: string
 *               miles:
 *                 type: number
 *               date:
 *                 type: string
 *     responses:
 *       201:
 *         description: Journey recorded successfully.
 *         content:
 *           application/json:
 *             example:
 *               _id: <journey_id>
 *               userId: <journey_userId>
 *               vehicleId: <journey_vehicleId>
 *               miles: <journey_miles>
 *               date: <journey_date>
 *               carbonEmission: <journey_carbonEmission>
 *       400:
 *         description: Error recording journey.
 *         content:
 *           application/json:
 *             example:
 *               error: Error recording journey.
 */

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
/**
 * @swagger
 * /journey/{journeyId}:
 *   get:
 *     summary: Get journey by ID
 *     description: Endpoint to get journey by ID
 *     parameters:
 *       - in: path
 *         name: journeyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Journey details retrieved successfully.
 *         content:
 *           application/json:
 *             example:
 *               _id: <journey_id>
 *               userId: <journey_userId>
 *               vehicleId: <journey_vehicleId>
 *               miles: <journey_miles>
 *               date: <journey_date>
 *               carbonEmission: <journey_carbonEmission>
 *       404:
 *         description: Journey not found.
 *         content:
 *           application/json:
 *             example:
 *               error: Journey not found.
 */

app.get('/journey/:journeyId', async (req, res) => {
  try {
    const journey = await Journey.findById(req.params.journeyId);
    res.status(200).json(journey);
  } catch (error) {
    res.status(404).json({ error: 'Journey not found' });
  }
});
// Function to calculate carbon emission 
function calculateCarbonEmission(miles) {
  // Assuming the formula: 35 miles/gallon and 8.8 kg CO2 is produced using each US gallon of fuel
  const emissionPerGallon = 8.8; // in kg
  const mileage = 35; // in miles/gallon

  const gallonsUsed = miles / mileage;
  const carbonEmission = gallonsUsed * emissionPerGallon;

  return carbonEmission;
}
/**
 * @swagger
 * /suggest/{userId}:
 *   get:
 *     summary: Get eco suggestions for a user
 *     description: Endpoint to get eco suggestions based on user data
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Eco suggestions retrieved successfully.
 *         content:
 *           application/json:
 *             example:
 *               suggestion: Consider alternating between using your car and going for public transportation. This is based on your average carbon emission <averageEmission> kg.
 *       500:
 *         description: Internal Server Error.
 *         content:
 *           application/json:
 *             example:
 *               error: Internal Server Error.
 */

// EcoSuggestions
app.get('/suggest/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    const averageEmission = await Journey.aggregate([
      { $match: { userId: req.params.userId } },
      { $group: { _id: null, avgEmission: { $avg: '$carbonEmission' } } },
    ]);

    const message = `Consider alternating between using your car and going for public transportation. This is based on your average carbon emission ${averageEmission[0].avgEmission} kg.`;

   
 

      
    res.status(200).json({ suggestion: message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


    

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
