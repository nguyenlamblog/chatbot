const fs = require("fs-extra");
module.exports = function ({ api, config, __GLOBAL, User, Thread }) {
	return function ({ event }) {
		switch (event.logMessageType) {
			case "log:subscribe":
				for (var i = 0; i < event.logMessageData.addedParticipants.length; i++) {
					if (event.logMessageData.addedParticipants[i].userFbId == api.getCurrentUserID()) {
						Thread.createThread(event.threadID);
						api.sendMessage(`Đã kết nối thành công!\nVui lòng sử dụng ${config.prefix}help để biết thêm chi tiết lệnh >w<`, event.threadID);
						api.changeNickname(config.botName, event.threadID, api.getCurrentUserID());
					}
					else {
						let uid = event.logMessageData.addedParticipants[i].userFbId;
						User.createUser(uid);
						User.getName(uid).then(name => {
							api.sendMessage({
								body: "Chào mừng " + name + " đã vào group.",
								mentions: [{
									tag: name,
									id: uid
								}]
							}, event.threadID);
						});
					}
				}
				break;
			case "log:unsubscribe":
				User.getName(event.logMessageData.leftParticipantFbId).then(name => api.sendMessage(name + " đã mãi mãi rời xa.", event.threadID));
				break;
			case "log:thread-icon":
				break;
			case "log:user-nickname":
				break;
			case "log:thread-color":
				break;
			case "log:thread-name":
				Thread.updateName(event.threadID, event.logMessageData.name);
				break;
		}
	}
}