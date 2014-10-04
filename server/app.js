/**
 * Main application file
 */

 'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var express = require('express');
var config = require('./config/environment');
// Setup server
var app = express();
var server = require('http').createServer(app);
require('./config/express')(app);
require('./routes')(app);
var io = require('socket.io')(server);


var ConversationManager = require('./components/ConversationManager.js')(io);
var UserManager = require('./components/UserManager.js');

//We want to keep a track of connected clients by Id
var clients = {};


io.on('connection', function(socket){ 
		clients[socket.id] = socket;
		var user = UserManager.CreateUser(socket.id,clients);
		console.log(user.Name + " connected");

		socket.broadcast.emit('user:connected', user.Serialize());

		socket.emit('init', { 
			userInfos : user.Serialize(),
			users : UserManager.ConnectedUsers
		});
		UserManager.AddUser(user);

		socket.on('disconnect', function () {
			console.log(user.Name + " disconnected");
			  //Notify the users
			socket.broadcast.emit('user:disconnected', user.Id);

			ConversationManager.LeaveAllConversations(user);
			UserManager.RemoveUser(user);
			delete clients[socket.id];
		});

		socket.on('change:name', function (data) {
			console.log(user.Name + " changed into " + data);
			user.Name = data;
		    //Notify the users
		    io.emit('user:namechanged', user.Serialize());
		});


		socket.on('conversation:start', function (id) {
			var otherUser = UserManager.GetUserById(id);
			if(otherUser===undefined) return;

			console.log("conversation created with "+ user.Name +" and " + otherUser.Name);

			var conversation=ConversationManager.CreateConversation(user,otherUser);

		    //Notify the users
		    socket.emit('conversation:started', {
				Conversation : conversation
		    });


		    otherUser.GetSocket().emit('conversation:started', {
				Conversation : conversation
		    });
		});

		socket.on('conversation:sendmessage', function (data) {
			var conv = ConversationManager.GetConversationById(data.RoomId);
			if(conv!==undefined){
				data.User = user;
				io.to(conv.RoomName).emit('conversation:sendmessage',data);
				console.log("Message : #" + data.RoomId + " > " + user.Name + " > " + data.Message)
			}
		});

		socket.on('conversation:invite', function (data) {
			var conv = ConversationManager.GetConversationById(data.ConversationId);
			var	otherUser = UserManager.GetUserById(data.UserId);
			if(conv!==undefined && otherUser !==undefined && conv.Participants.length<5){
				ConversationManager.JoinConversation(otherUser,conv);
				otherUser.GetSocket().emit('conversation:started', {
					Conversation : conv
				});
			}
		});

		socket.on('conversation:ban', function (data) {
			var conv = ConversationManager.GetConversationById(data.ConversationId);
			var	otherUser = UserManager.GetUserById(data.UserId);
			if(conv!==undefined && otherUser !==undefined){
				ConversationManager.LeaveConversation(otherUser,conv);
			}
		});

		socket.on('conversation:leave', function (id) {
			ConversationManager.LeaveConversationById(user,id);
		});
});

// Start server
server.listen(config.port, config.ip, function () {
	console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
});

// Expose app
exports = module.exports = app;