const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const { router } = require("./Routes/b2b/SalesForceRoutes");
const cors = require('cors')

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors())
app.use(express.json())

// Salesforce Login API
app.use("", router);


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
