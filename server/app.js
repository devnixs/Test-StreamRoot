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

//We want to keep a track of connected clients by Id
var clients = {};

//Model used to store the user informations
var UserInfo = function(id, socketId){
	this.Id =id;
	this.Name = 'Guest'+id;
	this.SocketId = socketId;
	this.GetSocket = function(){
		return clients[this.SocketId];
	}
	this.Serialize = function (){
		return {
			Id : this.Id,
			Name : this.Name
		};
	};
};

var UserManager = {
	TokenNumber:1,
	ConnectedUsers : [],
	AddUser : function(user){
		this.ConnectedUsers.push(user);
	},
	RemoveUser : function(user){
		//And remove the one from the list
		this.ConnectedUsers.splice(this.ConnectedUsers.indexOf(user), 1);
	},
	CreateUser : function(socketId){
		var user = new UserInfo(this.TokenNumber++,socketId);
		return user;
	},
	GetUserById : function(id){
		for (var i = 0; i < this.ConnectedUsers.length; i++) {
			if(this.ConnectedUsers[i].Id===id)
				return this.ConnectedUsers[i];
		}
		return undefined;
	}
};

var Conversation = function(id){
	this.Id = id;
	this.RoomName = 'Room ' + id;
	this.DisplayName = this.RoomName;
	this.Participants = [];
	this.AdminId = 0;
	this.RemoveParticipant = function(UserId){
		for (var i = 0; i < this.Participants.length; i++) {
			if(this.Participants[i].Id===UserId){
				console.log('Removed '+ UserId +' from the conversation ' + this.RoomName);
				this.Participants.splice(i,1);
				break;
			}
		}
	}
};

var ConversationManager = {
	TokenNumber : 1,
	Conversations :[],
	CreateConversation : function(User1,User2){
		var conversation = new Conversation(this.TokenNumber++);
		conversation.AdminId = User1.Id;
		this.JoinConversation(User1,conversation);
		this.JoinConversation(User2,conversation);
		this.Conversations.push(conversation);
		return conversation;
	},
	GetConversationById : function(Id){
		for (var i = 0; i < this.Conversations.length; i++) {
			if(this.Conversations[i].Id === Id){
				return this.Conversations[i];
			}
		}
		return undefined;
	},
	JoinConversation : function(user,conversation){
		conversation.Participants.push(user);
		console.log(user.Name + ' joined room '+ conversation.RoomName);
		io.to(conversation.RoomName).emit("conversation:userjoined",
		{
			User:user.Serialize(),
			ConversationId : conversation.Id
		});
		user.GetSocket().join(conversation.RoomName);
	},
	LeaveConversationById : function(user,conversationId){
		for (var i = 0; i < this.Conversations.length; i++) {
			if(this.Conversations[i].Id === conversationId){
				this.LeaveConversation(user,this.Conversations[i])
			}
		}
	},
	LeaveConversation : function(user,conversation){
			console.log(user.Name + ' leaved room '+ conversation.RoomName);
			user.GetSocket().leave(conversation.RoomName);
			user.GetSocket().emit('conversation:left',conversation.Id);
			conversation.RemoveParticipant(user.Id);

			if(conversation.Participants.length>0){
				io.to(conversation.RoomName).emit("conversation:userleft",
					{
						User:user.Serialize(),
						ConversationId:conversation.Id
					});

				//If the admin leaves, someone is designed to be the new admin
				if(conversation.AdminId === user.Id)
				{
					conversation.AdminId = conversation.Participants[0].Id;
					io.to(conversation.RoomName).emit("conversation:adminchanges",conversation);
				}
			}

	},
	LeaveAllConversations : function(user){
		for (var i = 0; i < this.Conversations.length; i++) {
			this.LeaveConversation(user,this.Conversations[i]);	
		}
	},
	SendMessageToConversation : function(User, ConversationId, Message){
		for (var i = 0; i < this.Conversations.length; i++) {
			if(this.Conversations[i].Id === ConversationId){
				User.socket.to(this.Conversations[i].RoomName).emit('user:messagesent',{
					RoomId : this.Conversations[i].Id,
					Message : Message,
					From : User.Serialize()
				});
				break;
			}
		}
	}
};


io.on('connection', function(socket){ 
		clients[socket.id] = socket;
		var user = UserManager.CreateUser(socket.id);
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