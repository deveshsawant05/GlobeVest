const express = require("express");
const os = require("os");

const router = express.Router();

router.get("/", (req, res) => {
    const uptime = process.uptime(); // Server uptime in seconds
    const memoryUsage = process.memoryUsage(); // Memory usage stats
    let loadAverage = null;
    if (os.platform() !== 'win32') {
        loadAverage = os.loadavg(); // System load average (Unix-based)
    }
    const timestamp = new Date().toLocaleString(); // Current server time

    // Get requester details
    const requesterIP = req.headers["x-forwarded-for"] || req.ip;
    const userAgent = req.headers["user-agent"];

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GlobeVest API Status</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap');
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Poppins', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                    color: white;
                    text-align: center;
                    overflow: hidden;
                }
                .status-container {
                    background: rgba(255, 255, 255, 0.2);
                    padding: 30px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                    width: 450px;
                    max-width: 90%;
                }
                h1 {
                    font-size: 2rem;
                    font-weight: 600;
                }
                p {
                    margin: 10px 0;
                    font-size: 1.1rem;
                }
                .highlight {
                    font-weight: bold;
                    color: #ffeb3b;
                }
                .small-text {
                    font-size: 0.9rem;
                    opacity: 0.8;
                }
                .divider {
                    width: 80%;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.5);
                    margin: 10px auto;
                }
            </style>
        </head>
        <body>
            <div class="status-container">
                <h1>🌎 GlobeVest Backend Status</h1>
                <p><span class="highlight">Status:</span> Running ✅</p>
                <p><span class="highlight">Uptime:</span> ${Math.floor(uptime / 60)} min ${Math.floor(uptime % 60)} sec</p>
                <p><span class="highlight">Memory Usage:</span> ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB</p>
                ${loadAverage ? `<p><span class="highlight">Load Average:</span> ${loadAverage.map(n => n.toFixed(2)).join(", ")}</p>` : ''}
                <p><span class="highlight">Server Time:</span> ${timestamp}</p>
                
                <div class="divider"></div>

                <p><span class="highlight">Requester IP:</span> ${requesterIP}</p>
                <p class="small-text"><span class="highlight">User Agent:</span> ${userAgent}</p>
            </div>
        </body>
        </html>
    `);
});

module.exports = router;
