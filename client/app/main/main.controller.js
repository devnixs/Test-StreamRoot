'use strict';

angular.module('testStreamrootApp')
.controller('MainCtrl', function ($scope, $http,socket) {
	$scope.users = [];
	$scope.conversations = [];

	socket.on('init', function (data) {
		$scope.userInfos = data.userInfos;
		$scope.users = data.users;
		$scope.conversations = [];
	});

	$scope.$watch("userInfos.Name", function (newname,oldname){
		if(newname !== undefined && oldname!==undefined){
			console.info('Renaming from '+ oldname +' to ' + newname);
			socket.emit('change:name',newname);
		}
	});

	socket.on('user:connected', function (data) {
		console.info("user connected",data);
		$scope.users.push(data);
	});

	socket.on('user:disconnected', function (data) {
		console.info("user disconnected",data);
		for (var i = $scope.users.length - 1; i >= 0; i--) {
			if($scope.users[i].Id === data){
				$scope.users.splice(i,1);
				break;
			}
		}
	});

	socket.on('user:namechanged', function (data) {
		console.info('user changed name',data);
		for (var i = $scope.users.length - 1; i >= 0; i--) {
			if($scope.users[i].Id === data.Id){
				$scope.users[i] = data;
				break;
			}
		}
	});


	socket.on('conversation:started', function (data) {
		console.info('conversation started',data);
		data.Conversation.IsAdmin = data.IsAdmin;
		for (var i = 0; i < $scope.conversations.length; i++) {
			$scope.conversations[i].Active=false;
		}
		data.Conversation.Active = true;
		data.Conversation.messageToSend = '';
		data.Conversation.content = '';
		$scope.conversations.push(data.Conversation);
	});

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


	socket.on('conversation:userleft', function (data) {
		console.info('user left the conversation',data);
		for (var i = 0; i < $scope.conversations.length; i++) {
			if($scope.conversations[i].Id===data.ConversationId)
			{
				for (var j = 0; j < $scope.conversations[i].Participants.length; j++) {
					if($scope.conversations[i].Participants[j].Id === data.User.Id){
						$scope.conversations[i].Participants.splice(j,1);
						return;
					}
				}
			}
		}
	});



	socket.on('conversation:sendmessage', function (data) {
		console.info('Message received',data);
		for (var i = 0; i < $scope.conversations.length; i++) {
			if($scope.conversations[i].Id===data.RoomId)
			{
				$scope.conversations[i].content = $scope.conversations[i].content+data.User.Name + ' > ' + data.Message + '\n';
			}
		}
	});

	$scope.LeaveConversation=function(RoomId){
		console.info('Leaving conversation',RoomId);
		socket.emit('conversation:leave',RoomId);
		for (var i = 0; i < $scope.conversations.length; i++) {
			if($scope.conversations[i].Id===RoomId)
			{
				$scope.conversations.splice(i,1);
			}
		}
	};

	$scope.SendMessageToConversation = function(){
		for (var i = 0; i < $scope.conversations.length; i++) {
			if($scope.conversations[i].Active===true){
				console.info('Sending "' + $scope.conversations[i].messageToSend +'" to room ' + $scope.conversations[i].Id)
				socket.emit('conversation:sendmessage',{
					RoomId : $scope.conversations[i].Id,
					Message : $scope.conversations[i].messageToSend
				});
				$scope.conversations[i].messageToSend='';
			}
		};
	};

	$scope.StartConversation = function(id){
		socket.emit('conversation:start',id);
	};

});
