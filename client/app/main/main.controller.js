'use strict';

angular.module('testStreamrootApp')
.controller('MainCtrl',['$scope', '$http','socket','$cookies', function ($scope, $http,socket,$cookies) {
	var self=this;
	$scope.users = [];
	$scope.conversations = [];

	socket.on('init', function (data) {
		$scope.userInfos = data.userInfos;
		$scope.users = data.users;
		$scope.conversations = [];

		//Load the name from the cookie if it exits
		if($cookies.Name!==undefined){
			$scope.userInfos.Name = $cookies.Name;
			socket.emit('change:name',$scope.userInfos.Name);
		}
	});

	//When the name changes
	$scope.$watch('userInfos.Name', function (newname,oldname){
		if(newname !== undefined && oldname!==undefined){
			console.info('Renaming from '+ oldname +' to ' + newname);
			socket.emit('change:name',newname);
			$cookies.Name = newname;
		}
	});

	socket.on('user:connected', function (data) {
		console.info('user connected',data);
		$scope.users.push(data);
	});

	socket.on('user:disconnected', function (data) {
		console.info('user disconnected',data);
		//Let's remove this user from all the rooms
		for (var i = $scope.users.length - 1; i >= 0; i--) {
			if($scope.users[i].Id === data){
				$scope.users.splice(i,1);
				break;
			}
		}
	});

	//when someone change his name
	socket.on('user:namechanged', function (data) {
		console.info('user changed name',data);
		for (var i = $scope.users.length - 1; i >= 0; i--) {
			if($scope.users[i].Id === data.Id){
				$scope.users[i] = data;
				break;
			}
		}

		for (i = 0; i < $scope.conversations.length; i++) {
			for (var j = 0; j < $scope.conversations[i].Participants.length; j++)
			{
				if($scope.conversations[i].Participants[j].Id === data.Id)
				{
					$scope.conversations[i].Participants[j]=data;
					break;
				}
			}
		}
		
	});

	//When a new conversation is started
	socket.on('conversation:started', function (data) {
		console.info('conversation started',data);

		//We want to focus on this conversation
		for (var i = 0; i < $scope.conversations.length; i++) {
			$scope.conversations[i].Active=false;
		}
		data.Conversation.Active = true;
		data.Conversation.messageToSend = '';
		data.Conversation.content = '';
		$scope.conversations.push(data.Conversation);
	});

	//When someone join a conversation
	socket.on('conversation:userjoined', function (data) {
		console.info('user joined the conversation',data);
		for (var i = 0; i < $scope.conversations.length; i++) {
			if($scope.conversations[i].Id===data.ConversationId)
			{
				$scope.conversations[i].Participants.push(data.User);
				break;
			}
		}
	});

	//When someone leave the conversation
	socket.on('conversation:userleft', function (data) {
		console.info('user left the conversation',data);
		for (var i = 0; i < $scope.conversations.length; i++) {
			if($scope.conversations[i].Id===data.ConversationId)
			{
				//We remove him from the participants
				for (var j = 0; j < $scope.conversations[i].Participants.length; j++) {
					if($scope.conversations[i].Participants[j].Id === data.User.Id){
						$scope.conversations[i].Participants.splice(j,1);
						return;
					}
				}
			}
		}
	});


	//When a message is sent from someone
	socket.on('conversation:sendmessage', function (data) {
		console.info('Message received',data);
		for (var i = 0; i < $scope.conversations.length; i++) {
			if($scope.conversations[i].Id===data.RoomId)
			{
				//We add the message to the right conversation
				$scope.conversations[i].content = $scope.conversations[i].content+data.User.Name + ' > ' + data.Message + '\n';
			}
		}
	});

	//When you are kicked out of the conversation or when you leave it
	socket.on('conversation:left', function (data) {
		console.info('Left conversation',data);
		for (var i = 0; i < $scope.conversations.length; i++) {
			if($scope.conversations[i].Id===data)
			{
				$scope.conversations.splice(i,1);
			}
		}
	});

	//When someone is designed to be the new admin
	socket.on('conversation:adminchanges', function (data) {
		console.info('Someone is the new admin',data);
		for (var i = 0; i < $scope.conversations.length; i++) {
			if($scope.conversations[i].Id===data.Id)
			{
				console.info('Conversation ' + i + ' : ' + data.AdminId + ' is the new admin',data);
				$scope.conversations[i].AdminId = data.AdminId;
			}
		}
	});

		

	$scope.LeaveConversation=function(RoomId){
		console.info('Leaving conversation',RoomId);
		socket.emit('conversation:leave',RoomId);
	};

	$scope.SendMessageToConversation = function(){
		for (var i = 0; i < $scope.conversations.length; i++) {
			if($scope.conversations[i].Active===true){
				console.info('Sending "' + $scope.conversations[i].messageToSend +'" to room ' + $scope.conversations[i].Id);
				socket.emit('conversation:sendmessage',{
					RoomId : $scope.conversations[i].Id,
					Message : $scope.conversations[i].messageToSend
				});
				$scope.conversations[i].messageToSend='';
			}
		}
	};

	$scope.StartConversation = function(id){
		socket.emit('conversation:start',id);
	};


	self.getActiveConversation = function(){
		var activeConversation;
		for (var i = 0; i < $scope.conversations.length; i++) {
			if($scope.conversations[i].Active===true){
				activeConversation=$scope.conversations[i];
				break;
			}
		}
		return activeConversation;
	};

	$scope.Invite = function(id){
		var activeConversation = self.getActiveConversation();

		if(activeConversation!==undefined){
			socket.emit('conversation:invite',{
				UserId : id,
				ConversationId : activeConversation.Id
			});
		}
	};

	$scope.IsInvitable = function(user){
		var activeConversation = self.getActiveConversation();
		if(activeConversation!==undefined){
			if(activeConversation.Participants.length>=5){
				return false;
			}

			for(var i = 0; i < activeConversation.Participants.length; i++) {
				if(activeConversation.Participants[i].Id === user.Id){
					return false;
				}
			}
		}
		else{
			return false;
		}

		return $scope.conversations.length>0;
	};

	$scope.IsBanable = function(user){
		var conv = self.getActiveConversation();
		if(conv!==undefined){
			return conv.AdminId=== $scope.userInfos.Id && user.Id !== $scope.userInfos.Id;
		}
	};

	$scope.Ban = function(userId){
		var conv = self.getActiveConversation();
		socket.emit('conversation:ban',{
			UserId : userId,
			ConversationId : conv.Id
		});
	};

}]);
