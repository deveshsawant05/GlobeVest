# 🌍 GlobeVest

**GlobeVest** is a cross-border investment platform that empowers users to invest seamlessly in foreign stock indices using a dual-wallet system. It bridges the gap between local currencies and foreign exchange (forex) by integrating secure wallet management, real-time forex conversion, and simplified international trading.

---

## 🚀 Features

- 💼 **Dual-Wallet System**  
  - **Local Wallet**: Holds the user's home currency.
  - **Forex Wallet**: Converts funds to a foreign currency for investment.

- 📈 **Real-Time Forex Integration**  
  - Up-to-date exchange rates for accurate conversions and investments.

- 🏛️ **Global Stock Market Access**  
  - Trade in international indices and markets with ease.

- 🔐 **Secure Authentication**  
  - Access and refresh tokens securely stored in the database.
  - Role-based access control for users and administrators.

- 📊 **Transaction History & Portfolio View**  
  - Track wallet funding, forex transactions, and investment activities.

- 🏗️ **Clean Architecture**  
  - Follows the MVC pattern for organized and scalable backend logic.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js
- **Styling**: Tailwind CSS

### Backend
- **Server**: Express.js
- **Database**: PostgreSQL (hosted on Render)
- **Architecture**: MVC
- **Auth**: Token-based (stored in DB, no JWT)

### Deployment
- **CI/CD**: Render (for both backend and PostgreSQL)

---

## 📦 Folder Structure

```

GlobeVest/
├── frontend/         # Next.js + Tailwind frontend
│   ├── components/
│   ├── pages/
│   └── ...
├── backend/          # Express MVC backend
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── ...
├── docs/             # API documentation and system architecture
└── README.md

````

---

## 📡 APIs

A full REST API handles:

- Authentication
- Forex conversion
- Wallet management
- Stock index listings
- Investment transactions
- Transaction history

> 📄 Full API documentation available in the `/docs` folder or Swagger (if hosted).

---

## 🔒 Authentication Flow

- Users log in via email and password.
- Access and refresh tokens are securely stored in PostgreSQL.
- Token validation middleware protects routes.
- Role-based access distinguishes between regular users and admins.

---

## 🧪 Getting Started Locally

### Prerequisites
- Node.js
- PostgreSQL
- Render (for deployment)

### Backend

```bash
cd backend
npm install
npm run dev
````

### Frontend

```bash
cd frontend
npm install
npm run dev
```

> Configure environment variables for both servers in `.env` files.

---

## 🌐 Environment Variables

```env
# Backend (.env)
DATABASE_URL=your_postgres_connection_string
ACCESS_TOKEN_SECRET=your_access_secret
REFRESH_TOKEN_SECRET=your_refresh_secret
FOREX_API_KEY=your_forex_api_key

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

---

## 📌 Roadmap

* [x] Basic wallet + forex functionality
* [x] Auth system with access/refresh tokens
* [x] Transaction tracking
* [ ] Admin dashboard
* [ ] Real-time forex charting
* [ ] Multi-language & localization support
* [ ] Investment recommendation engine (AI)

---

## 🤝 Contributing

We welcome contributions! Please fork the repo and open a pull request. Ensure your code follows our conventions and is well-documented.

---

## 📄 License

This project is licensed under the MIT License.

---

## ✨ Acknowledgements

* [Render](https://render.com) for seamless CI/CD and database hosting
* [bol.new](https://bol.new) for rapid UI prototyping
* [ExchangeRate-API](https://www.exchangerate-api.com/) for forex data

---

## 📬 Contact

For support or questions, reach out at **[support@globevest.app](mailto:support@globevest.app)**

```
