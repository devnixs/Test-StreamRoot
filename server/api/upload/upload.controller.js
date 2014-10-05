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

function getFileName(path) {
    var i = path.lastIndexOf('/');
    i = (i < 0) ? path.lastIndexOf('\\') : i;
    return (i < 0) ? '' : path.substr(i+1);
}

module.exports = function(app){
  return {
    index :function(req, res) {
      var data = _.pick(req.body, 'type');
      var file = req.files.file;
        res.send({
           Path : 'assets/uploaded/' + getFileName(file.path)
        });
    }
  }
}
  