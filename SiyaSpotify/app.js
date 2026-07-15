// app.js
// Load environment variables from .env (if present)
require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// Import routers
var authRouter = require('./routes/auth');
var indexRouter = require('./routes/index');

var app = express();

// Serve static HTML from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// 2. Set up global middlewares
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 3. Register your routers
// This mounts your /login and /callback endpoints at the root level ("/")
app.use('/', authRouter);
app.use('/', indexRouter);

// 4. Catch 404 handler (Must be below your routers!)
app.use(function (req, res, next) {
    next(createError(404));
});

// 5. Error handler
app.use(function (err, req, res, next) {
    // If an error occurs, try to send a static error page
    res.status(err.status || 500);
    var errorFile = path.join(__dirname, 'public', 'error.html');
    res.sendFile(errorFile, function (sendErr) {
        if (sendErr) {
            // Fallback to a JSON response if the static file can't be sent
            res.json({ message: err.message, error: req.app.get('env') === 'development' ? err : {} });
        }
    });
});

module.exports = app;
