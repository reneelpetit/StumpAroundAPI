const express = require("express");
const logger = require("morgan");
const mongoose = require("mongoose");
const axios = require("axios");
const moment = require('moment');

// Require all models
var db = require("./models");

const PORT = process.env.PORT || 8080;

// Initialize Express
const app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/StumpAround";
// // Connect to the Mongo DB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true });

// example routes
app.get("/hikes", function (req, res) {
    axios.get('https://www.hikingproject.com/data/get-trails?lat=45.52345&lon=-122.67621&maxDistance=300&key=200649274-302d66556efb2a72c44c396694a27540')
        .then(function (response) {
            // console.log(response.data.trails);
            let trailsData = response.data.trails;
            console.log(trailsData);
            for (let i = 0; i < trailsData.length; i++) {
                db.Hike.create({
                    name: trailsData[i].name,
                    summary: trailsData[i].summary,
                    photo: trailsData[i].imgSmall,
                    length: trailsData[i].length
                })
            }
        })
});

app.post("/", function (req, res) {
    res.json('POST');
});

// Start the server
app.listen(PORT, function () {
    console.log("App running on port " + PORT + "!");
});