import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
// Create an MCP server
const server = new McpServer({
    name: "weather-mcp",
    version: "1.0.0"
});
// Get weather data from a third-party API tool
const getWeatherData = server.tool('get-weather', 'Tool to get the weather for a city', {
    city: z.string().describe('The name of the city to get the weather for'),
}, async ({ city }) => {
    // get coordinates for the city
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=10&language=en&format=json`);
    const data = await response.json();
    // City not found
    if (data.results.length === 0) {
        return {
            content: [
                {
                    type: 'text',
                    text: `City "${city}" not found.`,
                }
            ]
        };
    }
    // get the weather data using coordinates of the first result
    const { latitude, longitude } = data.results[0];
    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,rain,showers,cloud_cover,apparent_temperature`);
    const weatherData = await weatherResponse.json();
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(weatherData, null, 2),
            }
        ]
    };
});
// Run the server with Stdio transport (Locally)
// const transport = new StdioServerTransport();
// server.connect(transport);
// Run the MCP server from remotely
const app = express();
app.use(express.json());
const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // set to undefined for stateless servers
});
// Setup routes for the server
const setupServer = async () => {
    await server.connect(transport);
};
app.post("/mcp", async (req, res) => {
    console.log("Received MCP request:", req.body);
    try {
        await transport.handleRequest(req, res, req.body);
    }
    catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: "2.0",
                error: {
                    code: -32603,
                    message: "Internal server error",
                },
                id: null,
            });
        }
    }
});
app.get("/mcp", async (req, res) => {
    console.log("Received GET MCP request");
    res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: "Say Hi by Edison.",
        },
        id: null,
    }));
});
app.delete("/mcp", async (req, res) => {
    console.log("Received DELETE MCP request");
    res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: "Say Hi by Edison.",
        },
        id: null,
    }));
});
// Start the server
const PORT = process.env.PORT || 3000;
setupServer()
    .then(() => {
    app.listen(PORT, () => {
        console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
    });
})
    .catch((error) => {
    console.error("Failed to set up the server:", error);
    process.exit(1);
});
