const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const app = express();
const session = require('express-session');
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public')); // Serve static files from the 'public' folder

// Middleware for session
app.use(
  session({
    secret: 'your-secret-key', // Replace with a secure key
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 }, // Session lasts for 1 hour
  })
);

// MySQL Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Mounika@281005',
  database: 'userdb',
});


db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL Database!');
});

// Serve the unified login.html file at the root URL
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

// Registration Route
app.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  const checkEmailSql = `SELECT * FROM users WHERE email = ?`;
  db.query(checkEmailSql, [email], (err, results) => {
      if (err) {
          console.error(err);
          res.status(500).json({ message: 'An error occurred. Please try again later.' });
          return;
      }

      if (results.length > 0) {
          res.status(400).json({ message: 'Email already registered. Please try signing in.' });
      } else {
          const insertSql = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;
          db.query(insertSql, [username, email, password], (err) => {
              if (err) {
                  console.error(err);
                  res.status(500).json({ message: 'An error occurred. Please try again later.' });
                  return;
              }
              res.json({ message: 'Registration successful! Bonus points added to your account.' });
          });
      }
  });
});

// Sign-in Route
app.post('/signin', (req, res) => {
  const { email, password } = req.body;
  const sql = `SELECT * FROM users WHERE email = ? AND password = ?`;

  db.query(sql, [email, password], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'An error occurred. Please try again later.' });
      return;
    }

    if (results.length > 0) {
      // Save user details in session
      req.session.user = {
        id: results[0].id,
        username: results[0].username,
        email: results[0].email,
        points: results[0].points || 100, // Default points if not set
      };
      res.json({ message: 'Login successful! Redirecting to your dashboard...' });
    } else {
      res.status(400).json({ message: 'Invalid email or password. Please try again.' });
    }
  });
});

// Serve the dashboard.html file
app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});

// Start the server
app.listen(4000, () => {
  console.log('Server running on http://localhost:4000');
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Could not log out. Please try again.');
    } else {
      res.redirect('/');
    }
  });
});

// Account Details Route
app.get('/account-details', (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ message: 'Unauthorized. Please sign in first.' });
    return;
  }

  // Send the user's account details
  res.json(req.session.user);
});

// Serve account.html
app.get('/account', (req, res) => {
  if (!req.session.user) {
    res.redirect('/'); // Redirect to login if not logged in
  } else {
    res.sendFile(__dirname + '/public/account.html');
  }
});

// Add Book Route
app.post('/give-book', (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ message: 'Unauthorized. Please log in first.' });
    return;
  }

  const { user } = req.session;
  const { bookTitle, authorName, bookSubject, condition, address } = req.body;

  const sql = `
    INSERT INTO books (username, email, title, author, subject, \`condition\`, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [user.username, user.email, bookTitle, authorName, bookSubject, condition, address],
    (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to add the book. Please try again.' });
      } else {
        res.json({ message: 'Book added successfully!' });
      }
    }
  );
});


app.get('/search-books', (req, res) => {
  const { query } = req.query; // Query contains title, author, subject, or location
  const sql = `
    SELECT id, title, author, subject, \`condition\`, address, email
    FROM books
    WHERE title LIKE ? OR author LIKE ? OR subject LIKE ? OR address LIKE ?
  `;
  const searchTerm = `%${query}%`;

  db.query(sql, [searchTerm, searchTerm, searchTerm, searchTerm], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Failed to fetch books. Please try again.' });
    } else {
      res.json(results);
    }
  });
});

app.post('/request-book', (req, res) => {
  console.log(req.body);  // Add this line to debug
  if (!req.session.user) {
      res.status(401).json({ message: 'Unauthorized. Please log in first.' });
      return;
  }

  const { bookId } = req.body; // Book ID from the front-end
  const { username, email } = req.session.user;

  const sql = `
      INSERT INTO requests (book_id, requested_by_username, requested_by_email)
      VALUES (?, ?, ?)
  `;

  db.query(sql, [bookId, username, email], (err) => {
      if (err) {
          console.error(err);
          res.status(500).json({ message: 'Failed to request the book. Please try again.' });
      } else {
          res.json({ message: 'Book requested successfully!' });
      }
  });
});

app.get('/view-requests', (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ message: 'Unauthorized. Please log in first.' });
    return;
  }

  const receivedSql = `
    SELECT 
      r.id, 
      b.title AS book_title, 
      b.author AS book_author, 
      r.requested_by_username, 
      r.request_status 
    FROM requests r
    JOIN books b ON r.book_id = b.id
    WHERE b.email = ?
  `;

  const sentSql = `
    SELECT 
      r.id, 
      b.title AS book_title, 
      b.author AS book_author, 
      r.request_status 
    FROM requests r
    JOIN books b ON r.book_id = b.id
    WHERE r.requested_by_email = ?
  `;

  // Execute both queries and send the data
  db.query(receivedSql, [req.session.user.email], (err, receivedRequests) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Failed to fetch received requests.' });
      return;
    }

    db.query(sentSql, [req.session.user.email], (err, sentRequests) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch sent requests.' });
        return;
      }

      res.json({
        receivedRequests,
        sentRequests,
      });
    });
  });
});

app.post('/update-request/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!req.session.user) {
    res.status(401).json({ message: 'Unauthorized. Please log in first.' });
    return;
  }

  const sql = `UPDATE requests SET request_status = ? WHERE id = ?`;

  db.query(sql, [status, id], (err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Failed to update request status.' });
    } else {
      res.json({ message: `Request status updated to ${status}.` });
    }
  });
});

// Get All Books Route
app.get('/all-books', (req, res) => {
  const sql = `
      SELECT title, author, subject, \`condition\`, address, email
      FROM books
  `;

  db.query(sql, (err, results) => {
      if (err) {
          console.error(err);
          res.status(500).json({ message: 'Failed to fetch all books. Please try again.' });
      } else {
          res.json(results);
      }
  });
});
