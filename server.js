require('dotenv').config();
const express = require("express");
const logger = require("morgan");
const mongoose = require("mongoose");
const axios = require("axios");
const moment = require('moment');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const User = require('./models/User.js');
const secret = process.env.SECRET;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const withAuth = require('./middleware');
// Require all models
var db = require("./models");

const PORT = process.env.PORT || 8080;

// Initialize Express
const app = express();
app.use(cookieParser());
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
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useFindAndModify: false });

// POST route to register a user
app.post('/api/register', function (req, res) {
    const { email, password, name } = req.body;
    const user = new User({ email, password, name });
    user.save(function (err) {
        if (err) {
            res.status(500)
                .json({ error: 0 });
        } else {
            res.status(200).json({ success: 1 })
        }
    });
});

app.post('/api/authenticate', function (req, res) {
    const { email, password } = req.body;
    User.findOne({ email }, function (err, user) {
        if (err) {
            console.error(err);
            res.status(500)
                .json({
                    error: 'Internal error try again'
                });
        } else if (!user) {
            res.status(401)
                .json({
                    error: 'Incorrect email or password'
                });
        } else {
            user.isCorrectPassword(password, function (err, same) {
                if (err) {
                    res.status(500)
                        .json({
                            error: 'Internal error try again'
                        });
                } else if (!same) {
                    res.status(401)
                        .json({
                            error: 'Incorrect email or password'
                        });
                } else {
                    const payload = { email };
                    const token = jwt.sign(payload, secret, {
                        expiresIn: '1h'
                    });
                    res.json({token, userId: user._id})
                }
            })
        }
    })
})
//post route to add hikes to database from API
app.post("/hikes", function (req, res) {
    axios.get('https://www.hikingproject.com/data/get-trails?lat=45.52345&lon=-122.67621&maxDistance=500&maxResults=500&key=200649274-302d66556efb2a72c44c396694a27540')
        .then(function (response) {
            // console.log(response.data.trails);
            let trailsData = response.data.trails;
            for (let i = 0; i < trailsData.length; i++) {
                db.Hike.create({
                    apiId: trailsData[i].id,
                    name: trailsData[i].name,
                    location: trailsData[i].location,
                    summary: trailsData[i].summary,
                    photo: trailsData[i].imgMedium,
                    length: trailsData[i].length,
                    latitude: trailsData[i].longitude,
                    longitude: trailsData[i].longitude,     
                })
                    .catch(function (err) {
                        if (err.errmsg.substr(0, 6) === "E11000") {
                            console.log("id already exists");
                        }
                        else {
                            console.log("other error");
                        }
                    })
            }
        })
    res.redirect("/hikes");
});

//get call to get all hikes from database
app.get("/hikes", function (req, res) {
    db.Hike.find({})
        .then(function (records) {
            res.json(records);
        })
});

//get call to grab only one hike from database
app.get("/hike/:id", function (req, res) {
    console.log("serverside ID is: ", req.params.id);
    db.Hike.findOne({ _id: req.params.id })
        .populate({
            path: "comments",
            populate: {
                path: 'user'
            }
        })
        .then(function (hikeRecord) {
            res.json(hikeRecord);
        })
        .catch(function (err) {
            res.json(err);
        });
});


//get route to get only one user's data
app.get("/user/:username", function (req, res) {
    let name = req.params.username;
    db.User.findOne({
        name: name
    })
        .select('-password -sentRequests -receivedRequests')
        .populate("comments")
        .populate({
            path: "profileComments",
            populate: {
                path: 'user'
            }
        })
        .populate({
            path: "friends",
            populate: {
                path: 'user'
            }
        })
        .populate("hikes")
        .then(function (userRecord) {
            res.json(userRecord);
        })
        .catch(function (err) {
            res.json(err);
        });
});

//get route to get only one user's data
app.post("/user/secure", withAuth, function (req, res) {
    db.User.findOne({
        email: req.email
    })
        .select('-password')
        .populate("comments")
        .populate({
            path: "profileComments",
            populate: {
                path: 'user'
            }
        })
        .populate({
            path: "friends",
            populate: {
                path: 'user'
            }
        })
        .populate({
            path: "sentRequests",
            populate: {
                path: 'user'
            }
        })
        .populate({
            path: "receivedRequests",
            populate: {
                path: 'user'
            }
        })
        .populate("hikes")
        .then(function (userRecord) {
            res.json(userRecord);
        })
        .catch(function (err) {
            res.json(err);
        });
});

app.get('/api/secret', withAuth, function(req, res) {
    res.send('YES');
});
 // route to ckeck the token
 app.get('/checkToken', withAuth, function(req, res) {
    res.sendStatus(200);
});
//route to update a user's bio
app.put("/bio", withAuth, function (req, res) {
    console.log("bio route whatever")
    db.User.findOneAndUpdate({ email: req.email }, { bio: req.body.bio })
    .then(function (updateBio) {
            db.User.findOne({ email: req.email })
            .then(function (updatedProfile) {
                console.log("bio updated!");
                    res.json(updatedProfile);
                })
                .catch(function (err) {
                    res.json(err);
                });
            })
})

// route to serve uploaded photos
app.get('/photo/:imgId', (req, res) => {
    res.sendFile(__dirname + `/uploads/images/${req.params.imgId}.jpg`);
})

const handleError = (err, res) => {
    console.log('in hndlerrfn', err);
    res
      .status(500)
      .contentType("text/plain")
      .end("Oops! Something went wrong!");
  };

const upload = multer({dest: __dirname + '/uploads/temp'});
// const upload = multer({dest: '/uploads/temp'});
//route to update a user's photo
app.post("/profileImageUpload", withAuth, upload.single('file'), function (req, res) {
    if (!req.file) {
        console.log("No file received");
        res
        .status(403)
        .contentType("text/plain")
        .end("No file received");
    } else {
        console.log('file received');
        return db.User.findOne({
            email: req.email
        })
        .then((foundProfile) => {
            console.log('found:', foundProfile);
            return db.User.findOneAndUpdate({ email: req.email }, { photo: `http://stump-around.herokuapp.com/photo/${foundProfile._id}` }, { new: true })
        })
        .then(
            (updatedProfile) => {
                console.log('updated:', updatedProfile);
                const tempPath = req.file.path;
                const targetPath = path.join(__dirname, `./uploads/images/${updatedProfile._id}.jpg`);
                fs.rename(tempPath, targetPath, err => {
                    if (err) return handleError(err, res);
            
                    res
                    .status(200)
                    // .contentType("text/plain")
                    .json(updatedProfile);
                });
        })
      }
    })
    
//route to add a hike comment
app.post("/comment", function (req, res) {
    db.Comment.create(req.body)
    .then(function (commentData) {
            console.log(commentData);
            db.Hike.findOneAndUpdate({ _id: req.body.hike }, { $push: { comments: commentData._id } }, { new: true })
                .then((result) => console.log(result));
                db.User.findOneAndUpdate({ _id: req.body.user }, { $push: { comments: commentData._id } }, { new: true })
                .then((result) => console.log(result));
                res.json(commentData);
        })
        .catch(function (err) {
            console.log(err);
        })
    })

app.post("/profileComment", function (req, res) {
    db.Comment.create({...req.body, profile: req.body.hike})
    .then(function (commentData) {
            console.log(commentData);
            db.User.findOneAndUpdate({ _id: req.body.hike }, { $push: { profileComments: commentData._id } }, { new: true })
                .then((result) => console.log(result));
                db.User.findOneAndUpdate({ _id: req.body.user }, { $push: { comments: commentData._id } }, { new: true })
                .then((result) => console.log(result));
                res.json(commentData);
        })
        .catch(function (err) {
            console.log(err);
        })
    })

    //route to add a hike to favorites
app.post("/favorite", function (req, res) {
    let userId = req.body.userId;
    let hikeId = req.body.hikeId;
    db.User.findOneAndUpdate(
        { _id: userId },
        { $addToSet: { hikes: hikeId } },
        { new: true }
    )
    .then(function (userRecord) {
        res.json(userRecord);
    })
    .catch(function (err) {
        res.json(err);
    });
})
//route to delete a favorite from user
app.delete("/favorite", function (req, res) {
    let userId = req.body.userId;
    let hikeId = req.body.hikeId;
    db.User.findOneAndUpdate(
        { _id: userId },
        { $pull: { hikes: hikeId } },
        { new: true }
        )
        .then(function (userRecord) {
            res.json(userRecord);
        })
    .catch(function (err) {
        res.json(err);
    });
})

//delete a comment
app.delete("/commentdelete", function (req, res) {
    console.log(req.body);
    db.Comment.findOne({
        _id: req.body.id
    })
        .then(function (commentData) {
            console.log(commentData);
            db.User.findOne({
                _id: req.body.user
            })
                .then(function (userData) {
                    if (userData._id.equals(commentData.users)) {
                        db.Comment.deleteOne({ _id: req.body.id })
                            .then(function (commentDelete) {
                                console.log("comment deleted");
                                res.json(commentDelete.hikes);
                            })
                        }
                    else {
                        res.json("You don't have permissions to delete this.")
                    }
                })

            })
        });

        app.post("/", function (req, res) {
    res.json('POST');
});
app.post("/login", function (req, res) {
    res.json('POST login');
});
app.post("/signup", function (req, res) {
    res.json('POST signup');
});
// Start the server
app.listen(PORT, function () {
    console.log("App running on port " + PORT + "!");
});

    //post route to add a user to the database
    // app.post("/user/add", function (req, res) {
    //     console.log("post user add", req.body);
    //     let name = req.body.name;
    //     db.User.find({ name: name }, { name: 1 }).limit(1)
    //         .then(function (userRecords) {
    //             console.log(userRecords);
    //             if (userRecords.length) {
    //                 console.log("user exists already; cannot add user");
    //             }
    //             else {
    //                 console.log("new user; adding to database");
    //                 db.User.create({
    //                     name: req.body.name,
    //                     password: req.body.password,
    //                     email: req.body.email
    //                 })
    //             }
    //         })
    // });
