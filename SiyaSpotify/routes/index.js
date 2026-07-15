var express = require('express');
var router = express.Router();
var path = require('path');

/* GET home page. */
router.get('/', function(req, res, next) {
  // Serve the static index.html from the public folder
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = router;
