/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /things              ->  index
 * POST    /things              ->  create
 * GET     /things/:id          ->  show
 * PUT     /things/:id          ->  update
 * DELETE  /things/:id          ->  destroy
 */

'use strict';

var path = require('path');
var _ = require('lodash');
var fs = require('fs');

function ensureExists(path, cb) {
    fs.mkdir(path, 777, function(err) {
        if (err) {
            if (err.code === 'EEXIST') cb(null); // ignore the error if the folder already exists
            else cb(err); // something else went wrong
        } else cb(null); // successfully created folder
    });
}

function getExtension(filename) {
    var i = filename.lastIndexOf('.');
    return (i < 0) ? '' : filename.substr(i);
}

// Get list of things
exports.index = function(req, res) {
  var data = _.pick(req.body, 'type');
  var file = req.files.file;

  console.log(file.path); //tmp path (ie: /tmp/12345-xyaz.png)

    var newFileName = (+new Date()).toString(36) + getExtension(file.name);

    // get the temporary location of the file
    var tmp_path = file.path;
    // set where the file should actually exists - in this case it is in the "images" directory
    var target_path = __dirname + '/../../../client/assets/uploaded/';

    console.log(tmp_path);
    console.log(target_path);

    ensureExists(target_path,function(){
    // move the file from the temporary location to the intended location
      fs.rename(tmp_path, target_path + newFileName, function(err) {
          if (err) throw err;
          // delete the temporary file, so that the explicitly set temporary upload dir does not get filled with unwanted files
          fs.unlink(tmp_path, function(err2) {
              res.send({
                 Path : 'assets/uploaded/' +newFileName 
              });
          });
      });
    });

};