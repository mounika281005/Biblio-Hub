# Biblio Hub

Biblio Hub is an online book exchange platform that allows users to connect and exchange books with others. Users can list their books, browse books shared by others, and request exchanges seamlessly. This project is built with modern web technologies for an efficient and user-friendly experience.

## Features

- **User Registration and Authentication:** Secure user sign-up and login system.
- **Book Listing:** Users can add books they want to exchange.
- **Book Browsing:** Browse books shared by other users.
- **Request Management:** Request book exchanges and track the status.
- **Notifications:** Get notified about exchange requests and updates.

## Technologies Used

### Frontend
- **HTML**
- **CSS**
- **React.js**

### Backend
- **Node.js** (Express.js)

### Database
- **MySQL**

## Installation

Follow the steps below to set up the project locally:

### Prerequisites
- Node.js installed
- MySQL server installed

### Steps
1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-username/biblio-hub.git
   cd biblio-hub
   ```

2. **Frontend Setup:**
   - Navigate to the `frontend` directory:
     ```bash
     cd frontend
     ```
   - Install dependencies:
     ```bash
     npm install
     ```
   - Start the development server:
     ```bash
     npm start
     ```

3. **Backend Setup:**
   - Navigate to the `backend` directory:
     ```bash
     cd backend
     ```
   - Install dependencies:
     ```bash
     npm install
     ```
   - Set up the MySQL database:
     - Create a new database named `biblio_hub`.
     - Import the provided SQL file (`database/biblio_hub.sql`) into the database.
     - Update the `config/database.js` file with your MySQL credentials.
   - Start the backend server:
     ```bash
     npm start
     ```

4. **Access the Application:**
   - Open your browser and navigate to `http://localhost:3000` (or the port you configured).

## Directory Structure
```
Biblio Hub/
|-- frontend/       # React.js frontend code
|-- backend/        # Node.js backend code
|-- database/       # SQL files for database setup
|-- README.md       # Project documentation
```

## Contributing

Contributions are welcome! Here's how you can contribute:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-name`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature-name`).
5. Open a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Happy coding! If you have any questions or suggestions, feel free to open an issue.
