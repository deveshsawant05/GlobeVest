import express, { json } from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(json()); // For parsing JSON request bodies

app.get('/', (req, res) => {
    res.send(`
        <html>
            <body>
                <h1>GlobeVest Backend</h1>
                <p>Status: Service running</p>
                <p>Server Time: ${new Date().toLocaleString()}</p>
            </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});