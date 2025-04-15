# Stock Market Backend for GlobeVest

This is a simulated stock market data provider for the GlobeVest application. It provides real-time price updates for stocks across various markets.

## Features

- RESTful API endpoints for fetching stock data
- WebSocket connections for real-time price updates
- Simulated price movements for realistic trading experience
- Support for multiple markets and currencies

## Setup and Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the root directory (or modify the existing one):
   ```
   PORT=5001
   FRONTEND_URL=http://localhost:3000
   PRICE_UPDATE_INTERVAL=5000
   ```

3. Start the server:
   ```
   npm start
   ```

   For development with auto-reload:
   ```
   npm run dev
   ```

## API Endpoints

- `GET /api/stocks` - Get all available stocks
- `GET /api/stocks/:stockId` - Get details for a specific stock
- `GET /api/markets/:market` - Get all stocks for a specific market

## WebSocket Events

### Client to Server
- `subscribeToStock` - Subscribe to updates for a specific stock
- `unsubscribeFromStock` - Unsubscribe from updates for a specific stock

### Server to Client
- `stocksInitial` - Initial stock data sent on connection
- `stocksUpdate` - Batch updates for all stocks
- `stockUpdate` - Update for a specific stock

## Integration with Main Application

1. Configure the main GlobeVest backend to use this service for stock data
2. Update the frontend to consume WebSocket events for real-time updates

## Extending the Simulation

The stock data generation and price movements can be customized in the `stockDataGenerator.js` file. You can:

- Add more stocks to the initial data
- Adjust the price movement algorithms
- Add market-specific events or volatility patterns 