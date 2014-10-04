'use strict';

angular.module('testStreamrootApp')
.controller('MainCtrl',['$scope', '$http','socket','$cookies','$upload', function ($scope, $http,socket,$cookies,$upload) {
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
		data.Conversation.content = [];
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
				$scope.conversations[i].content.push({
					From : data.User.Name,
					Content : data.Message,
					Img : data.Img
				});
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


  $scope.onFileSelect = function($files) {
      console.log($files);
      var file = $files[0];
      $scope.upload = $upload.upload({
        url: 'api/upload', //upload.php script, node.js route, or servlet url
        //method: 'POST' or 'PUT',
        //headers: {'header-key': 'header-value'},
        //withCredentials: true,
        data: {myObj: $scope.myModelObj},
        file: file, // or list of files ($files) for html5 only
        //fileName: 'doc.jpg' or ['1.jpg', '2.jpg', ...] // to modify the name of the file(s)
        // customize file formData name ('Content-Disposition'), server side file variable name. 
        //fileFormDataName: myFile, //or a list of names for multiple files (html5). Default is 'file' 
        // customize how data is added to formData. See #40#issuecomment-28612000 for sample code
        //formDataAppender: function(formData, key, val){}
      }).progress(function(evt) {
        console.log('percent: ' + parseInt(100.0 * evt.loaded / evt.total));
      }).success(function(data, status, headers, config) {

		var conv = self.getActiveConversation();
			if(conv!==undefined){
				socket.emit('conversation:sendmessage',{
					RoomId : conv.Id,
					Message : '',
					Img : data.Path
				});
		}
        // file is uploaded successfully
        console.log(data);
      });
      //.error(...)
      //.then(success, error, progress); 
      // access or attach event listeners to the underlying XMLHttpRequest.
      //.xhr(function(xhr){xhr.upload.addEventListener(...)})
    };
    /* alternative way of uploading, send the file binary with the file's content-type.
       Could be used to upload files to CouchDB, imgur, etc... html5 FileReader is needed. 
       It could also be used to monitor the progress of a normal http post/put request with large data*/
    // $scope.upload = $upload.http({...})  see 88#issuecomment-31366487 for sample code.
}]);
