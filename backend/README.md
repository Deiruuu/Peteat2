# PetEat Backend

Backend server for the PetEat application. This server handles authentication, user management, and connects to MongoDB.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/users/auth/google/callback
```

3. Create admin users:

```bash
npm run create-admins
```

## MongoDB Setup

1. Create a MongoDB Atlas account or use an existing one
2. Create a new cluster or use an existing one
3. Get your MongoDB connection string and add it to the `.env` file

## Running the Server

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Login a user
- `GET /api/users/auth/google` - Google OAuth login
- `GET /api/users/auth/google/callback` - Google OAuth callback

### Users

- `GET /api/users` - Get all users (admin only)
- `GET /api/users/profile` - Get current user profile
- `GET /api/users/:id` - Get user by ID (admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin only)

## Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Navigate to APIs & Services > Credentials
4. Create OAuth 2.0 Client IDs
5. Add authorized redirect URIs:
   - `http://localhost:5000/api/users/auth/google/callback`
   - Add your production URL if deployed
6. Get the Client ID and Client Secret and add them to your `.env` file 