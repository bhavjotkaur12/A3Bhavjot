const express = require('express');
const mongoose = require('mongoose');
const exphbs = require("express-handlebars");
const session = require('express-session');

const app = express();


// Set up handlebars
app.engine(".handlebars", exphbs.engine({
    extname: ".handlebars",
    helpers: {
        json: (context) => { return JSON.stringify(context) },
        formatPrice: (length) => { return (length * 0.65).toFixed(2); }
    },
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true,
      },
  }));
  app.set("view engine", ".handlebars");
  

// Set up express middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
// Set up express-session middleware
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
  }));

// Connect to MongoDB
mongoose.connect('mongodb+srv://bhavjotkaur12:Iam12102001@cluster0.dwy8png.mongodb.net/?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });

// Define MongoDB Schemas
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  isAdmin: { type: Boolean, default: false },
});

const classSchema = new mongoose.Schema({
  name: String,
  length: Number,
  imageName: String,
});

const paymentSchema = new mongoose.Schema({
  username: String,
  className: String,
  priceBeforeTax: Number,
  totalAmountPaid: Number,
  dateCreated: {
    type: Date,
    default: Date.now,
    get: function(date) {
      return date.toDateString() + " " + date.toLocaleTimeString();
    }
  },
});

const cartItemSchema = new mongoose.Schema({
    username: String,
    classId: String,
    className: String,

  });

// Define MongoDB Models
const User = mongoose.model('User', userSchema);
const Class = mongoose.model('Class', classSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const CartItem = mongoose.model('CartItem', cartItemSchema);


// Implement routes
app.get('/', async (req, res) => {
  try {
    const classes = await Class.find();
    const loggedIn = req.session && req.session.user;
    const user = req.session.user || {};
    res.render('index', { classes, loggedIn, user, layout: "main" });
  } catch (error) {
    console.error(error);
    res.status(500).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Server error</div>');
  }
});
// Add this code after the index route
app.get('/login', (req, res) => {
    res.render('login', { layout: "main" });
  });
  
  app.get('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        console.error(err);
        res.status(500).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Server error</div>');
      } else {
        res.redirect('/');
      }
    });
  });
  

// Implement logic for user authentication, booking classes, and handling payments
function isLoggedIn(req, res, next) {
    if (req.session && req.session.user) {
        console.log("isLoggedIn: User is logged in");
      next();
    } else {
      console.log("isLoggedIn: User is not logged in");
      res.status(401).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Unauthorised</div>');

    }
  }
  
  // Middleware to check if the user is an admin
  function isAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.isAdmin) {
      next();
    } else {
      res.status(403).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Forbidden</div>');
    }
  }

// Auth route
app.post('/auth', async (req, res) => {
    const { username, password, submit } = req.body;

    if (submit === 'login') {
        try {
            const user = await User.findOne({ username, password });
            if (user) {
                req.session.user = user;
                res.redirect('/classes');
            } else {
                res.status(401).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Invalid username or password</div>');
            }
        } catch (error) {
            console.error(error);
            res.status(500).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Server error</div>');

        }
    } else if (submit === 'create-account') {
        try {
            const isAdmin = username === 'admin' && password === '0000';
            const newUser = new User({ username, password, isAdmin: isAdmin });
            await newUser.save();
            req.session.user = newUser;
            res.redirect('/classes');
        } catch (error) {
            console.error(error);
            res.status(500).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Server error</div>');
        }
    } else {
        res.status(400).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Invalid request</div>');
    }
});

app.get('/admin', isLoggedIn, isAdmin, async (req, res) => {
    try {
      const payments = await Payment.find().sort({ dateCreated: 1 });
      const loggedIn = req.session && req.session.user;
    const user = req.session.user || {};
    res.render('admin', { payments, loggedIn, user, layout: "main" });
    } catch (error) {
      console.error(error);
      res.status(500).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Server error</div>');
    }
  });

// Classes route
app.get('/classes', async (req, res) => {
    try {
      const classes = await Class.find();
      const loggedIn = req.session && req.session.user;
      res.render('classes', { classes, loggedIn });
    } catch (error) {
      console.error(error);
      res.status(500).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Server error</div>');
    }
  });
  


  app.get('/cart', isLoggedIn, async (req, res) => {
    try {
      const cartItems = await CartItem.find({ username: req.session.user.username });
      const loggedIn = req.session && req.session.user;
    const user = req.session.user || {};
    res.render('cart', { cartItems, loggedIn, user, layout: "main" });
      
    } catch (error) {
      console.error(error);
      res.status(500).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Server error</div>');
    }
  });

// Book Class
app.post('/book-class/:classId', async (req, res) => {
    if (req.session && req.session.user) {
      try {
        const selectedClass = await Class.findById(req.params.classId);
        const priceBeforeTax = selectedClass.length * 0.65;
        const totalAmountPaid = (priceBeforeTax * 1.13).toFixed(2);
        const payment = new Payment({
          username: req.session.user.username,
          className: selectedClass.name,
          priceBeforeTax,
          totalAmountPaid,
        });
        await payment.save();
        const cartItem = new CartItem({
          username: req.session.user.username,
          classId: selectedClass._id,
          className: selectedClass.name,
        
        });
        await cartItem.save();
        res.status(200).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Class booked successfully</div>');
      } catch (error) {
        console.error(error);
        res.status(500).send('<div style="color:red;background-color:yellow; font-weight:bold; padding:15px;">Server error</div>');
      }
    } else {
      res.status(401).send('<div style="color:red; background-color:yellow; font-weight:bold; padding:15px;">You must be logged in to book a class</div>');
    }
  });

  

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
