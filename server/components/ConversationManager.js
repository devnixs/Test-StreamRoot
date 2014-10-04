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

var ConversationManager = function(io){
	this.TokenNumber = 1;
	this.Conversations =[];
	this.CreateConversation = function(User1,User2){
		var conversation = new Conversation(this.TokenNumber++);
		conversation.AdminId = User1.Id;
		this.JoinConversation(User1,conversation);
		this.JoinConversation(User2,conversation);
		this.Conversations.push(conversation);
		return conversation;
	};
	this.GetConversationById = function(Id){
		for (var i = 0; i < this.Conversations.length; i++) {
			if(this.Conversations[i].Id === Id){
				return this.Conversations[i];
			}
		}
		return undefined;
	};
	this.JoinConversation = function(user,conversation){
		conversation.Participants.push(user);
		console.log(user.Name + ' joined room '+ conversation.RoomName);
		io.to(conversation.RoomName).emit("conversation:userjoined",
		{
			User:user.Serialize(),
			ConversationId : conversation.Id
		});
		user.GetSocket().join(conversation.RoomName);
	};
	this.LeaveConversationById = function(user,conversationId){
		for (var i = 0; i < this.Conversations.length; i++) {
			if(this.Conversations[i].Id === conversationId){
				this.LeaveConversation(user,this.Conversations[i])
			}
		}
	};
	this.LeaveConversation = function(user,conversation){
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

	};
	this.LeaveAllConversations = function(user){
		for (var i = 0; i < this.Conversations.length; i++) {
			this.LeaveConversation(user,this.Conversations[i]);	
		}
	};
	this.SendMessageToConversation = function(User, ConversationId, Message){
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
}

module.exports = function(io){
	return new ConversationManager(io);
}
	
