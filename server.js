const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

const app = express();

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
  })
);

// ================= DATABASE CONNECTION =================
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Mounika@281005',
  database: 'biblio_hub',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.promise()
  .query('SELECT 1')
  .then(() => console.log('Connected to MySQL'))
  .catch((err) => console.error('MySQL connection failed:', err.message));

async function getRequestStatusColumn(queryRunner) {
  const [statusColumnRows] = await queryRunner.query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'requests'
      AND COLUMN_NAME IN ('status', 'request_status')
    ORDER BY FIELD(COLUMN_NAME, 'status', 'request_status')
    LIMIT 1
    `
  );

  return statusColumnRows.length > 0 ? statusColumnRows[0].COLUMN_NAME : null;
}

// ================= ROUTES =================

// Serve login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ================= REGISTER =================
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const [existingUser] = await db.promise().query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.promise().query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.json({ message: 'Registration successful! Please login.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================= LOGIN =================
app.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const [users] = await db.promise().query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      redeem_points: user.redeem_points,
    };

    res.json({ message: 'Login successful! Redirecting to dashboard...' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================= DASHBOARD (PROTECTED) =================
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ================= ACCOUNT PAGE (PROTECTED) =================
app.get('/account', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'account.html'));
});

// ================= ACCOUNT DETAILS (PROTECTED) =================
app.get('/account-details', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Please login first' });
    }

    const [rows] = await db.promise().query(
      'SELECT username, email, redeem_points FROM users WHERE id = ?',
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      username: rows[0].username,
      email: rows[0].email,
      points: rows[0].redeem_points
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ================= MY AVAILABLE BOOKS (PROTECTED) =================
app.get('/my-books', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Please login first' });
    }

    // Keep book ownership/status consistent for all previously accepted requests.
    // This also fixes older data created before transfer logic was added.
    const statusColumn = await getRequestStatusColumn(db.promise());
    if (statusColumn) {
      await db.promise().query(
        `
        UPDATE books b
        JOIN requests r ON r.book_id = b.id
        SET b.user_id = r.requester_id,
            b.status = 'Available'
        WHERE r.${statusColumn} = 'Accepted'
          AND (b.user_id != r.requester_id OR b.status != 'Available')
        `
      );
    }

    const [books] = await db.promise().query(
      `
      SELECT id, title, author, subject, condition_type, status, created_at
      FROM books
      WHERE user_id = ? AND status = 'Available'
      ORDER BY id DESC
      `,
      [req.session.user.id]
    );

    return res.json({ books });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ================= VIEW REQUESTS (PROTECTED) =================
app.get('/view-requests', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Please login first' });
    }

    const userId = req.session.user.id;
    const statusColumn = await getRequestStatusColumn(db.promise());

    if (!statusColumn) {
      return res.status(500).json({ message: 'Requests status column is missing' });
    }

    const [receivedRows] = await db.promise().query(
      `
      SELECT
        r.id,
        r.${statusColumn} AS request_status,
        b.title AS book_title,
        b.author AS book_author,
        u.username AS requested_by_username
      FROM requests r
      JOIN books b ON r.book_id = b.id
      JOIN users u ON r.requester_id = u.id
      WHERE r.owner_id = ?
      ORDER BY r.id DESC
      `,
      [userId]
    );

    const [sentRows] = await db.promise().query(
      `
      SELECT
        r.id,
        r.${statusColumn} AS request_status,
        b.title AS book_title,
        b.author AS book_author
      FROM requests r
      JOIN books b ON r.book_id = b.id
      WHERE r.requester_id = ?
      ORDER BY r.id DESC
      `,
      [userId]
    );

    const receivedRequests = receivedRows.map((row) => ({
      id: row.id,
      book_title: row.book_title,
      book_author: row.book_author,
      requested_by_username: row.requested_by_username,
      request_status: row.request_status || 'Pending'
    }));

    const sentRequests = sentRows.map((row) => ({
      id: row.id,
      book_title: row.book_title,
      book_author: row.book_author,
      request_status: row.request_status || 'Pending'
    }));

    return res.json({ receivedRequests, sentRequests });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ================= POINTS HISTORY (PROTECTED) =================
app.get('/points-history', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Please login first' });
    }

    const userId = req.session.user.id;
    const statusColumn = await getRequestStatusColumn(db.promise());

    if (!statusColumn) {
      return res.status(500).json({ message: 'Requests status column is missing' });
    }

    const [rows] = await db.promise().query(
      `
      SELECT
        r.id AS request_id,
        b.title AS book_title,
        u_req.username AS other_user,
        'Credit' AS transaction_type,
        100 AS points
      FROM requests r
      JOIN books b ON r.book_id = b.id
      JOIN users u_req ON r.requester_id = u_req.id
      WHERE r.owner_id = ?
        AND r.${statusColumn} = 'Accepted'

      UNION ALL

      SELECT
        r.id AS request_id,
        b.title AS book_title,
        u_own.username AS other_user,
        'Debit' AS transaction_type,
        100 AS points
      FROM requests r
      JOIN books b ON r.book_id = b.id
      JOIN users u_own ON r.owner_id = u_own.id
      WHERE r.requester_id = ?
        AND r.${statusColumn} = 'Accepted'

      ORDER BY request_id DESC
      `,
      [userId, userId]
    );

    return res.json({ history: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ================= UPDATE REQUEST STATUS (PROTECTED) =================
app.post('/update-request-status', async (req, res) => {
  let connection;
  try {
    connection = await db.promise().getConnection();

    if (!req.session.user) {
      return res.status(401).json({ message: 'Please login first' });
    }

    const { requestId, status } = req.body;
    const ownerId = req.session.user.id;

    if (!requestId || !['Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid request data' });
    }

    await connection.beginTransaction();

    const [requests] = await connection.query(
      'SELECT id, book_id, requester_id FROM requests WHERE id = ? AND owner_id = ?',
      [requestId, ownerId]
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Request not found' });
    }

    const requestRow = requests[0];
    const statusColumn = await getRequestStatusColumn(connection);

    if (!statusColumn) {
      await connection.rollback();
      return res.status(500).json({ message: 'Requests status column is missing' });
    }

    const [currentStatusRows] = await connection.query(
      `SELECT ${statusColumn} AS current_status FROM requests WHERE id = ?`,
      [requestId]
    );

    const currentStatus = currentStatusRows[0]?.current_status || 'Pending';
    if (currentStatus !== 'Pending') {
      await connection.rollback();
      return res.status(400).json({ message: 'Only pending requests can be updated' });
    }

    await connection.query(
      `UPDATE requests SET ${statusColumn} = ? WHERE id = ?`,
      [status, requestId]
    );

    if (status === 'Accepted') {
      const [requesterRows] = await connection.query(
        'SELECT redeem_points FROM users WHERE id = ?',
        [requestRow.requester_id]
      );

      const requesterPoints = requesterRows[0]?.redeem_points ?? 0;
      if (requesterPoints < 100) {
        await connection.rollback();
        return res.status(400).json({ message: 'Requester does not have enough points (need 100)' });
      }

      await connection.query(
        'UPDATE users SET redeem_points = redeem_points - 100 WHERE id = ?',
        [requestRow.requester_id]
      );

      await connection.query(
        'UPDATE users SET redeem_points = redeem_points + 100 WHERE id = ?',
        [ownerId]
      );

      await connection.query(
        `UPDATE requests
         SET ${statusColumn} = 'Rejected'
         WHERE book_id = ? AND id != ? AND ${statusColumn} = 'Pending'`,
        [requestRow.book_id, requestId]
      );

      await connection.query(
        'UPDATE users SET books_given = books_given + 1 WHERE id = ?',
        [ownerId]
      );

      await connection.query(
        'UPDATE users SET books_taken = books_taken + 1 WHERE id = ?',
        [requestRow.requester_id]
      );

      await connection.query(
        'UPDATE books SET user_id = ?, status = "Available" WHERE id = ?',
        [requestRow.requester_id, requestRow.book_id]
      );
    } else {
      await connection.query(
        'UPDATE books SET status = "Available" WHERE id = ?',
        [requestRow.book_id]
      );
    }

    await connection.commit();
    return res.json({ message: `Request ${status.toLowerCase()} successfully` });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});
// ================= GIVE BOOK PAGE (PROTECTED) =================
app.get('/give_book.html', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  res.sendFile(path.join(__dirname, 'public', 'give_book.html'));
});

// ================= TAKE BOOK PAGE (PROTECTED) =================
app.get('/take_book.html', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  res.sendFile(path.join(__dirname, 'public', 'take_book.html'));
});

// ================= ADD BOOK =================
app.post('/give-book', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Please login first' });
    }

    const { bookTitle, authorName, bookSubject, condition, address } = req.body;

    if (!bookTitle || !authorName || !bookSubject || !condition || !address) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    await db.promise().query(
      `INSERT INTO books 
       (user_id, title, author, subject, condition_type, address, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Available')`,
      [
        req.session.user.id,
        bookTitle,
        authorName,
        bookSubject,
        condition,
        address
      ]
    );

    res.json({ message: 'Book added successfully!' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================= SEARCH BOOKS =================
app.get('/search-books', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Please login first' });
    }

    const search = req.query.query || '';
    const subject = req.query.subject || '';
    const includeOwn = String(req.query.includeOwn || '').toLowerCase() === 'true';

    const [books] = await db.promise().query(
      `
      SELECT 
        b.id,
        b.user_id AS owner_id,
        b.title,
        b.author,
        b.subject,
        b.condition_type,
        b.address,
        u.username AS owner_name
      FROM books b
      JOIN users u ON b.user_id = u.id
      WHERE b.status = 'Available'
        AND (? = 1 OR b.user_id != ?)
        AND (? = '' OR b.subject LIKE CONCAT('%', ?, '%'))
        AND (
          b.title LIKE ?
          OR b.author LIKE ?
          OR b.subject LIKE ?
        )
      `,
      [
        includeOwn ? 1 : 0,
        req.session.user.id,
        subject,
        subject,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      ]
    );

    res.json(
      books.map((book) => ({
        ...book,
        is_own: Number(book.owner_id) === Number(req.session.user.id),
      }))
    );

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================= REQUEST BOOK =================
app.post('/request-book', async (req, res) => {
  let connection;

  try {
    connection = await db.promise().getConnection();

    if (!req.session.user) {
      return res.status(401).json({ message: 'Please login first' });
    }

    const { bookId } = req.body;
    const requesterId = req.session.user.id;

    if (!bookId) {
      return res.status(400).json({ message: 'Invalid book request' });
    }

    await connection.beginTransaction();

    const [books] = await connection.query(
      'SELECT * FROM books WHERE id = ? AND status = "Available"',
      [bookId]
    );

    if (books.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Book is no longer available' });
    }

    const book = books[0];

    if (book.user_id === requesterId) {
      await connection.rollback();
      return res.status(400).json({ message: 'You cannot request your own book' });
    }

    const statusColumn = await getRequestStatusColumn(connection);
    if (!statusColumn) {
      await connection.rollback();
      return res.status(500).json({ message: 'Requests status column is missing' });
    }

    const [existingRequests] = await connection.query(
      `SELECT id FROM requests
       WHERE book_id = ? AND requester_id = ? AND ${statusColumn} = 'Pending'`,
      [bookId, requesterId]
    );

    if (existingRequests.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'You already requested this book' });
    }

    await connection.query(
      `INSERT INTO requests (book_id, requester_id, owner_id)
       VALUES (?, ?, ?)`,
      [bookId, requesterId, book.user_id]
    );

    await connection.query(
      'UPDATE books SET status = "Requested" WHERE id = ?',
      [bookId]
    );

    await connection.commit();

    res.json({ message: 'Book requested successfully! Points are deducted only after acceptance.' });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});
// ================= LOGOUT =================
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ================= START SERVER =================
const PORT = Number(process.env.PORT) || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set PORT to a free port and restart.`);
    return;
  }
  console.error('Server failed to start:', err.message);
});

