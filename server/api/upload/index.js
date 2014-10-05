'use strict';

var express = require('express');
var controller = require('./upload.controller');

var router = express.Router();


module.exports = function(app){
	router.post('/', controller(app).index);
	return router;
};