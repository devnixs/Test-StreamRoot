

//Model used to store the user informations
var UserInfo = function(id, socketId,clients){
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

module.exports = {
	TokenNumber:1,
	ConnectedUsers : [],
	AddUser : function(user){
		this.ConnectedUsers.push(user);
	},
	RemoveUser : function(user){
		//And remove the one from the list
		this.ConnectedUsers.splice(this.ConnectedUsers.indexOf(user), 1);
	},
	CreateUser : function(socketId,clients){
		var user = new UserInfo(this.TokenNumber++,socketId,clients);
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