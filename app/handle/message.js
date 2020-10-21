module.exports = function({ api, modules, config, __GLOBAL, User, Thread, Rank, Economy, Fishing, Nsfw }) {
	/* ================ Config ==================== */
	let {prefix, canCheckUpdate, googleSearch, wolfarm, yandex, openweather, tenor, saucenao, waketime, sleeptime, admins, nsfwGodMode} = config;
	const fs = require("fs-extra");
	const moment = require("moment-timezone");
	const request = require("request");
	const ms = require("parse-ms");
	const stringSimilarity = require('string-similarity');
	const axios = require('axios');
	var resetNSFW = false;

	/* ================ Check update ================ */
	if (canCheckUpdate) {
		const semver = require('semver');
		axios.get('https://raw.githubusercontent.com/roxtigger2003/mirai/master/package.json').then((res) => {
			modules.log("Đang kiểm tra cập nhật...", 1);
			var local = JSON.parse(fs.readFileSync('./package.json')).version;
			if (semver.lt(local, res.data.version)) {
				modules.log('Đã có bản cập nhật mới! Hãy bật terminal/cmd và gõ "node update" để cập nhật!', 1);
				fs.writeFileSync('./.needUpdate', '');
			}
			else {
				if (fs.existsSync('./.needUpdate')) fs.removeSync('./.needUpdate');
				modules.log('Bạn đang sử dụng bản mới nhất!', 1);
			}
		}).catch(err => console.error(err));
	}

	/* ================ CronJob ==================== */
	if (!fs.existsSync(__dirname + "/src/groupID.json")) {
		var data = [];
		api.getThreadList(100, null, ["INBOX"], function(err, list) {
			if (err) throw err;
			list.forEach(item => (item.isGroup == true) ? data.push(item.threadID) : '');
			fs.writeFile(__dirname + "/src/groupID.json", JSON.stringify(data), err => {
				if (err) throw err;
				modules.log("Tạo file groupID mới thành công!");
			});
		});
	}
	else {
		fs.readFile(__dirname + "/src/groupID.json", "utf-8", (err, data) => {
			if (err) throw err;
			var groupids = JSON.parse(data);
			if (!fs.existsSync(__dirname + "/src/listThread.json")) fs.writeFile(__dirname + "/src/listThread.json", JSON.stringify({ wake: [], sleep: [] }), err => modules.log("Tạo file listThread mới thành công!"));
			setInterval(() => {
				var oldData = JSON.parse(fs.readFileSync(__dirname + "/src/listThread.json"));
				var timer = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm");
				groupids.forEach(item => {
					while (timer == sleeptime && !oldData.sleep.includes(item)) {
						api.sendMessage(`Tới giờ ngủ rồi đấy nii-chan, おやすみなさい!`, item);
						oldData.sleep.push(item);
						break;
					}
					while (timer == waketime && !oldData.wake.includes(item)) {
						api.sendMessage(`おはようございます các nii-chan uwu`, item);
						oldData.wake.push(item);
						break;
					}
					fs.writeFileSync(__dirname + "/src/listThread.json", JSON.stringify(oldData));
				});
				if (timer == "23:05" || timer == "07:05") fs.writeFileSync(__dirname + "/src/listThread.json", JSON.stringify({ wake: [], sleep: [] }));
				if (timer == "00:00")
					if (resetNSFW == false) {
						resetNSFW = true;
						Economy.resetNSFW();
					}
			}, 1000);
		});
	}

	if (!fs.existsSync(__dirname + "/src/shortcut.json")) {
		var template = [];
		fs.writeFileSync(__dirname + "/src/shortcut.json", JSON.stringify(template));
		modules.log('Tạo file shortcut mới thành công!');
	}

	return function({ event }) {
		let { body: contentMessage, senderID, threadID, messageID } = event;
		senderID = parseInt(senderID);
		threadID = parseInt(threadID);

		if (__GLOBAL.userBlocked.includes(senderID)) return;
		User.createUser(senderID);
		Thread.createThread(threadID);

		__GLOBAL.messages.push({
			msgID: messageID,
			msgBody: contentMessage
		});

		if (event.mentions) {
			var mentions = Object.keys(event.mentions);
			mentions.forEach(mention => {
				if (__GLOBAL.afkUser.includes(parseInt(mention))) {
					(async () => {
						var reason = await User.getReason(Object.keys(event.mentions));
						var name = await User.getName(Object.keys(event.mentions));
						reason == "none" ? api.sendMessage(`${name} Hiện tại đang bận!`, threadID, messageID) : api.sendMessage(`${name} Hiện tại đang bận với lý do: ${reason}`, threadID, messageID);
					})();
					return;
				}
			});
		}

		if (__GLOBAL.afkUser.includes(parseInt(senderID))) {
			(async () => {
				await User.nonafk(senderID);
				await User.updateReason(senderID, "");
				__GLOBAL.afkUser.splice(__GLOBAL.afkUser.indexOf(senderID), 1);
				var name = await User.getName(senderID);
				return api.sendMessage(`Chào mừng bạn đã quay trở lại, ${name}`,threadID);
			})();
		}

		if (!contentMessage) return;

	/* ================ Staff Commands ==================== */
		//lấy shortcut
		if (contentMessage.length !== -1) {
			let shortcut = JSON.parse(fs.readFileSync(__dirname + "/src/shortcut.json"));
			if (shortcut.some(item => item.id == threadID)) {
				let getThread = shortcut.find(item => item.id == threadID).shorts;
				if (getThread.some(item => item.in == contentMessage)) return api.sendMessage(getThread.find(item => item.in == contentMessage).out, threadID);
			}
		}

		//lấy file cmds
		var nocmdData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));

		//tạo 1 đối tượng mới nếu group chưa có trong file cmds
		if (!nocmdData.banned.some(item => item.id == threadID)) {
			let addThread = {
				id: threadID,
				cmds: []
			};
			nocmdData.banned.push(addThread);
			fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(nocmdData));
		}

		//lấy lệnh bị cấm trong group
		var cmds = nocmdData.banned.find(item => item.id == threadID).cmds;
		for (const item of cmds) if (contentMessage.indexOf(prefix + item) == 0) return api.sendMessage("Lệnh này đã bị cấm!", threadID, messageID);

		//unban command
		if (contentMessage.indexOf(`${prefix}unban command`) == 0 && admins.includes(senderID)) {
			var content = contentMessage.slice(prefix.length + 14,contentMessage.length);
			if (!content) return api.sendMessage("Hãy nhập lệnh cần bỏ cấm!", threadID, messageID);
			var jsonData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));
			var getCMDS = jsonData.banned.find(item => item.id == threadID).cmds;
			if (!getCMDS.includes(content)) return api.sendMessage("Lệnh " + content + " chưa bị cấm", threadID, messageID);
			else {
				let getIndex = getCMDS.indexOf(content);
				getCMDS.splice(getIndex, 1);
				api.sendMessage("Đã bỏ cấm " + content + " trong group này", threadID, messageID);
			}
			return fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(jsonData), "utf-8");
		}

		//ban command
		if (contentMessage.indexOf(`${prefix}ban command`) == 0 && admins.includes(senderID)) {
			var content = contentMessage.slice(prefix.length + 12, contentMessage.length);
			if (!content) return api.sendMessage("Hãy nhập lệnh cần cấm!", threadID, messageID);
			var jsonData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));
			if (content == "list") {
				return api.sendMessage(`Đây là danh sách các command hiện đang bị ban tại group này: ${nocmdData.banned.find(item => item.id == threadID).cmds}`, threadID, messageID);
			}
			if (!jsonData.cmds.includes(content)) return api.sendMessage("Không có lệnh " + content + " trong cmds.json nên không thể cấm", threadID, messageID);
			else {
				if (jsonData.banned.some(item => item.id == threadID)) {
					let getThread = jsonData.banned.find(item => item.id == threadID);
					getThread.cmds.push(content);
				}
				else {
					let addThread = {
						id: threadID,
						cmds: []
					};
					addThread.cmds.push(content);
					jsonData.banned.push(addThread);
				}
				api.sendMessage("Đã cấm " + content + " trong group này", threadID, messageID);
			}
			return fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(jsonData), "utf-8");
		}

		// Unban thread
		if (__GLOBAL.threadBlocked.includes(threadID)) {
			if (contentMessage == `${prefix}unban thread` && admins.includes(senderID)) {
				const indexOfThread = __GLOBAL.threadBlocked.indexOf(threadID);
				if (indexOfThread == -1) return api.sendMessage("Nhóm này chưa bị chặn!", threadID, messageID);
				Thread.unban(threadID).then(success => {
					if (!success) return api.sendMessage("Không thể bỏ chặn nhóm này!", threadID, messageID);
					api.sendMessage("Nhóm này đã được bỏ chặn!", threadID, messageID);
					__GLOBAL.threadBlocked.splice(indexOfThread, 1);
					modules.log(threadID, "Unban Thread");
				});
			}
			return;
		}

		Rank.updatePoint(senderID, 1);

		// Unban user
		if (contentMessage.indexOf(`${prefix}unban`) == 0 && admins.includes(senderID)) {
			const mentions = Object.keys(event.mentions);
			if (!mentions) return api.sendMessage("Vui lòng tag những người cần unban", threadID, messageID);
			mentions.forEach(mention => {
				const indexOfUser = __GLOBAL.userBlocked.indexOf(parseInt(mention));
				if (indexOfUser == -1)
					return api.sendMessage({
						body: `${event.mentions[mention]} chưa bị ban, vui lòng ban trước!`,
						mentions: [{
							tag: event.mentions[mention],
							id: mention
						}]
					}, threadID, messageID);
				User.unban(mention).then(success => {
					if (!success) return api.sendMessage("Không thể unban người này!", threadID, messageID);
					api.sendMessage({
						body: `Đã unban ${event.mentions[mention]}!`,
						mentions: [{
							tag: event.mentions[mention],
							id: mention
						}]
					}, threadID, messageID);
					__GLOBAL.userBlocked.splice(indexOfUser, 1);
					modules.log(mentions, "Unban User");
				});
			});
			return;
		}

		// Ban thread
		if (contentMessage == `${prefix}ban thread` && admins.includes(senderID)) {
			Thread.ban(parseInt(threadID)).then((success) => {
				if (!success) return api.sendMessage("Không thể ban group này!", threadID, messageID);
				api.sendMessage("Nhóm này đã bị chặn tin nhắn!.", threadID, messageID);
				__GLOBAL.threadBlocked.push(parseInt(threadID));
			})
			return;
		}

		// Ban user
		if (contentMessage.indexOf(`${prefix}ban`) == 0 && admins.includes(senderID)) {
			const mentions = Object.keys(event.mentions);
			if (!mentions) return api.sendMessage("Vui lòng tag những người cần ban!", threadID, messageID);
			mentions.forEach(mention => {
				if (__GLOBAL.threadBlocked.includes(mention)) return api.sendMessage(`${event.mentions[mention]} đã bị ban từ trước!`, threadID, messageID);
				User.ban(parseInt(mention)).then((success) => {
					if (!success) return api.sendMessage("Không thể ban người này!", threadID, messageID);
					api.sendMessage({
						body: `${event.mentions[mention]} đã bị ban!`,
						mentions: [{
							tag: event.mentions[mention],
							id: parseInt(mention)
						}]
					}, threadID, messageID);
					__GLOBAL.userBlocked.push(parseInt(mention));
					modules.log(parseInt(mention), 'Ban User');
				})
			});
			return;
		}

		//resend
		if (contentMessage.indexOf(`${prefix}resend`) == 0) {
			var content = contentMessage.slice(prefix.length + 7, contentMessage.length);
			if (content == 'off') {
				if (__GLOBAL.resendBlocked.includes(threadID)) return api.sendMessage("Nhóm này đã bị tắt resend từ trước!", threadID, messageID);
				Thread.blockResend(threadID).then((success) => {
					if (!success) return api.sendMessage("Oops, không thể tắt resend ở nhóm này!", threadID, messageID);
					api.sendMessage("Đã tắt resend tin nhắn thành công!", threadID, messageID);
					__GLOBAL.resendBlocked.push(threadID);
				})
			}
			else if (content == 'on') {
				if (!__GLOBAL.resendBlocked.includes(threadID)) return api.sendMessage("Nhóm này chưa bị tắt resend", threadID, messageID);
				Thread.unblockResend(threadID).then(success => {
					if (!success) return api.sendMessage("Oops, không thể bật resend ở nhóm này!", threadID, messageID);
					api.sendMessage("Đã bật resend tin nhắn, tôi sẽ nhắc lại tin nhắn bạn đã xoá 😈", threadID, messageID);
					__GLOBAL.resendBlocked.splice(__GLOBAL.resendBlocked.indexOf(threadID), 1);
				});
			}
			return;
		}

		//Thông báo tới toàn bộ group!
		if (contentMessage.indexOf(`${prefix}noti`) == 0 && admins.includes(senderID)) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (!content) return api.sendMessage("Nhập thông tin vào!", threadID, messageID);
			return api.getThreadList(100, null, ["INBOX"], (err, list) => {
				if (err) throw err;
				list.forEach(item => (item.isGroup == true && item.threadID != threadID) ? api.sendMessage(content, item.threadID) : '');
				api.sendMessage('Đã gửi thông báo với nội dung:\n' + content, threadID, messageID);
			});
		}

		//giúp thành viên thông báo lỗi về admin
		if (contentMessage.indexOf(`${prefix}report`) == 0) {
			var content = contentMessage.slice(prefix.length + 7, contentMessage.length);
			if (!content) return api.sendMessage("Có vẻ như bạn chưa nhập thông tin, vui lòng nhập thông tin lỗi mà bạn gặp!", threadID, messageID);
			(async () => {
				var userName = await User.getName(senderID);
				var threadName = await Thread.getName(threadID);
				api.sendMessage(
					"Báo cáo từ: " + userName +
					"\nGroup gặp lỗi: " + threadName +
					"\nLỗi gặp phải: " + content +
					"\nThời gian báo: " + moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss"),
					admins[0]
				);
			})()
			return api.sendMessage("Thông tin lỗi của bạn đã được gửi về admin!", threadID, messageID);
		}

		//nsfw
		if (contentMessage.indexOf(`${prefix}nsfw`) == 0 && admins.includes(senderID)) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (content == 'off') {
				if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đã bị tắt NSFW từ trước!", threadID, messageID);
				Thread.blockNSFW(threadID).then((success) => {
					if (!success) return api.sendMessage("Oops, không thể tắt NSFW ở nhóm này!", threadID, messageID);
					api.sendMessage("Đã tắt NSFW thành công!", threadID, messageID);
					__GLOBAL.NSFWBlocked.push(threadID);
				})
			}
			else if (content == 'on') {
				if (!__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này chưa bị tắt NSFW", threadID, messageID);
				Thread.unblockNSFW(threadID).then(success => {
					if (!success) return api.sendMessage("Oops, không thể bật NSFW ở nhóm này!", threadID, messageID);
					api.sendMessage("Đã bật NSFW thành công!", threadID, messageID);
					__GLOBAL.NSFWBlocked.splice(__GLOBAL.NSFWBlocked.indexOf(threadID), 1);
				});
			}
			return;
		}

		//restart
		if (contentMessage == `${prefix}restart` && admins.includes(senderID)) return api.sendMessage(`Hệ thống restart khẩn ngay bây giờ!!`, threadID, () => require("node-cmd").run("pm2 restart 0"), messageID);

		//admin command
		if (contentMessage.indexOf(`${prefix}admin`) == 0 && admins.includes(senderID)) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var helpList = JSON.parse(fs.readFileSync(__dirname + "/src/help/listAC.json"));
			if (content.indexOf("all") == 0) {
				var commandAdmin = [];
				helpList.forEach(help => (!commandAdmin.some(item => item.name == help.name)) ? commandAdmin.push(help.name) : commandAdmin.find(item => item.name == help.name).push(help.name));
				return api.sendMessage(commandAdmin.join(', '), threadID, messageID);
			}
			else if (content.indexOf("help") == 0) {
				var helpCommand = content.slice(5, content.length);
				if (helpList.some(item => item.name == helpCommand))
					return api.sendMessage(
						'=== Thông tin lệnh bạn đang tìm ===\n' +
						'- Tên lệnh: ' + helpList.find(item => item.name == helpCommand).name + '\n' +
						'- Thông tin: ' + helpList.find(item => item.name == helpCommand).decs + '\n' +
						'- Cách dùng: ' + prefix + helpList.find(item => item.name == helpCommand).usage + '\n' +
						'- Hướng dẫn: ' + prefix + helpList.find(item => item.name == helpCommand).example,
						threadID, messageID
					);
				else return api.sendMessage(`Lệnh bạn nhập không hợp lệ, hãy gõ ${prefix}help để xem tất cả các lệnh có trong bot.`, threadID, messageID);
			} else if (content.indexOf("listThread") == 0) {
			
			}
		}

	/* ==================== Help Commands ================*/

		//help
		if (contentMessage.indexOf(`${prefix}help`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			var helpList = JSON.parse(fs.readFileSync(__dirname + "/src/help/listCommands.json"));
			if (content.length == 0) {
				var helpGroup = [];
				var helpMsg = "";
				helpList.forEach(help => (!helpGroup.some(item => item.group == help.group)) ? helpGroup.push({ group: help.group, cmds: [help.name] }) : helpGroup.find(item => item.group == help.group).cmds.push(help.name));
				helpGroup.forEach(help => helpMsg += `===== ${help.group.charAt(0).toUpperCase() + help.group.slice(1)} =====\n${help.cmds.join(', ')}\n\n`);
				return api.sendMessage(helpMsg, threadID, messageID);
			}
			else {
				if (helpList.some(item => item.name == content))
					return api.sendMessage(
						'=== Thông tin lệnh bạn đang tìm ===\n' +
						'- Tên lệnh: ' + helpList.find(item => item.name == content).name + '\n' +
						'- Nhóm lệnh: ' + helpList.find(item => item.name == content).group + '\n' +
						'- Thông tin: ' + helpList.find(item => item.name == content).decs + '\n' +
						'- Cách dùng: ' + prefix + helpList.find(item => item.name == content).usage + '\n' +
						'- Hướng dẫn: ' + prefix + helpList.find(item => item.name == content).example,
						threadID, messageID
					);
				else return api.sendMessage(`Lệnh bạn nhập không hợp lệ, hãy gõ ${prefix}help để xem tất cả các lệnh có trong bot.`, threadID, messageID);
			}
		}

		//yêu cầu công việc cho bot
		if (contentMessage.indexOf(`${prefix}request`) == 0) {
			var content = contentMessage.slice(prefix.length + 8,contentMessage.length);
			if (!fs.existsSync(__dirname + "/src/requestList.json")) {
				let requestList = [];
				fs.writeFileSync(__dirname + "/src/requestList.json",JSON.stringify(requestList));
			}
			if (content.indexOf("add") == 0) {
				var addnew = content.slice(4, content.length);
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				getData.push(addnew);
				fs.writeFileSync(__dirname + "/src/requestList.json", JSON.stringify(getData));
				return api.sendMessage("Đã thêm: " + addnew, threadID, () => api.sendMessage("ID " + senderID + " Đã thêm '" + addnew + "' vào request list", admins[0]), messageID);
			}
			else if (content.indexOf("del") == 0 && admins.includes(senderID)) {
				var deletethisthing = content.slice(4, content.length);
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				if (getData.length == 0) return api.sendMessage("Không tìm thấy " + deletethisthing, threadID, messageID);
				var itemIndex = getData.indexOf(deletethisthing);
				getData.splice(itemIndex, 1);
				fs.writeFileSync(__dirname + "/src/requestList.json", JSON.stringify(getData));
				return api.sendMessage("Đã xóa: " + deletethisthing, threadID, messageID);
			}
			else if (content.indexOf("list") == 0) {
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				if (getData.length == 0) return api.sendMessage("Không có việc cần làm", threadID, messageID);
				let allWorks = "";
				getData.map(item => allWorks = allWorks + `\n- ` + item);
				return api.sendMessage("Đây là toàn bộ yêu cầu mà các bạn đã gửi:" + allWorks, threadID, messageID);
			}
		}

	/* ==================== Cipher Commands ================*/

		//morse
		if (contentMessage.indexOf(`${prefix}morse`) == 0) {
			const morsify = require('morsify');
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (event.type == "message_reply") (content.indexOf('en') == 0) ? api.sendMessage(morsify.encode(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(morsify.decode(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help morse`, threadID, messageID);
			else (content.indexOf('en') == 0) ? api.sendMessage(morsify.encode(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(morsify.decode(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help morse`, threadID, messageID);
		}

		//caesar
		if (contentMessage.indexOf(`${prefix}caesar`) == 0) {
			if (process.env.CAESAR == '' || process.env.CAESAR == null) return api.sendMessage('Chưa đặt mật khẩu CAESAR trong file .env', threadID, messageID);
			const Caesar = require('caesar-salad').Caesar;
			var content = contentMessage.slice(prefix.length + 7, contentMessage.length);
			if (event.type == "message_reply")(content.indexOf('encode') == 0) ? api.sendMessage(Caesar.Cipher(process.env.CAESAR).crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('decode') == 0) ? api.sendMessage(Caesar.Decipher(process.env.CAESAR).crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help caesar`, threadID, messageID);
			else(content.indexOf('encode') == 0) ? api.sendMessage(Caesar.Cipher(process.env.CAESAR).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('decode') == 0) ? api.sendMessage(Caesar.Decipher(process.env.CAESAR).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help caesar`, threadID, messageID);
		}

		//vigenere
		if (contentMessage.indexOf(`${prefix}vigenere`) == 0) {
			if (process.env.VIGENERE == '' || process.env.VIGENERE == null) return api.sendMessage('Chưa đặt mật khẩu VIGENERE trong file .env', threadID, messageID);
			const Vigenere = require('caesar-salad').Vigenere;
			var content = contentMessage.slice(prefix.length + 9, contentMessage.length);
			if (event.type == "message_reply")(content.indexOf('en') == 0) ? api.sendMessage(Vigenere.Cipher(process.env.VIGENERE).crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(Vigenere.Decipher(process.env.VIGENERE).crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help vigenere`, threadID, messageID)
			else(content.indexOf('en') == 0) ? api.sendMessage(Vigenere.Cipher(process.env.VIGENERE).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(Vigenere.Decipher(process.env.VIGENERE).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help vigenere`, threadID, messageID);
		}

		//rot47
		if (contentMessage.indexOf(`${prefix}rot47`) == 0) {
			const ROT47 = require('caesar-salad').ROT47;
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (event.type == "message_reply") (content.indexOf('en') == 0) ? api.sendMessage(ROT47.Cipher().crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(ROT47.Decipher().crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help rot47`, threadID, messageID);
			else (content.indexOf('en') == 0) ? api.sendMessage(ROT47.Cipher().crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(ROT47.Decipher().crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help rot47`, threadID, messageID);
		}

	/* ==================== Media Commands ==================== */

		//youtube music
		if (contentMessage.indexOf(`${prefix}audio`) == 0)
			return (async () => {
				var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 6, contentMessage.length);
				var ytdl = require("ytdl-core");
				var ffmpeg = require("fluent-ffmpeg");
				var ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
				ffmpeg.setFfmpegPath(ffmpegPath);
				if (content.indexOf("http") == -1) content = (await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&key=${googleSearch}&q=${encodeURIComponent(content)}`, {responseType: 'json'})).data.items[0].id.videoId;
				ytdl.getInfo(content, (err, info) => (info.length_seconds > 360) ? api.sendMessage("Độ dài video vượt quá mức cho phép, tối đa là 6 phút!", threadID, messageID) : '');
				return ffmpeg().input(ytdl(content)).toFormat("mp3").pipe(fs.createWriteStream(__dirname + "/src/music.mp3")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/music.mp3")}, threadID, () => fs.unlinkSync(__dirname + "/src/music.mp3"), messageID));
			})();

		//youtube video
		if (contentMessage.indexOf(`${prefix}video`) == 0)
			return (async () => {
				var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 6, contentMessage.length);
				var ytdl = require("ytdl-core");
				if (content.indexOf("http") == -1) content = (await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&key=${googleSearch}&q=${encodeURIComponent(content)}`, {responseType: 'json'})).data.items[0].id.videoId;
				ytdl.getInfo(content, (err, info) => (info.length_seconds > 360) ? api.sendMessage("Độ dài video vượt quá mức cho phép, tối đa là 6 phút!", threadID, messageID) : '');
				return ytdl(content).pipe(fs.createWriteStream(__dirname + "/src/video.mp4")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/video.mp4")}, threadID, () => fs.unlinkSync(__dirname + "/src/video.mp4"), messageID));
			})();

		//anime
		if (contentMessage.indexOf(`${prefix}anime`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var jsonData = fs.readFileSync(__dirname + "/src/anime.json");
			var data = JSON.parse(jsonData).sfw;
			if (!content || !data.hasOwnProperty(content)) {
				let sfwList = [];
				Object.keys(data).forEach(endpoint => sfwList.push(endpoint));
				let sfwTags = sfwList.join(', ');
				return api.sendMessage(`=== Tất cả các tag Anime ===\n` + sfwTags, threadID, messageID);
			}
			return request(data[content], (error, response, body) => {
				let picData = JSON.parse(body);
				let getURL = picData.data.response.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID));
			});
		}

		//meme
		if (contentMessage == `${prefix}meme`)
			return request("https://meme-api.herokuapp.com/gimme/memes", (err, response, body) => {
				if (err) throw err;
				var content = JSON.parse(body);
				let title = content.title;
				var baseurl = content.url;
				let callback = function() {
					api.sendMessage({
						body: `${title}`,
						attachment: fs.createReadStream(__dirname + "/src/meme.jpg")
					}, threadID, () => fs.unlinkSync(__dirname + "/src/meme.jpg"), messageID);
				};
				request(baseurl).pipe(fs.createWriteStream(__dirname + `/src/meme.jpg`)).on("close", callback);
			});

		//gif
		if (contentMessage.indexOf(`${prefix}gif`) == 0) {
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			if (content.length == -1) return api.sendMessage(`Bạn đã nhập sai format, vui lòng ${prefix}help gif để biết thêm chi tiết!`, threadID, messageID);
			if (content.indexOf(`cat`) !== -1) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=cat&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + `/src/randompic.gif`)).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`dog`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=dog&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`capoo`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=capoo&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`mixi`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=mixigaming&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`bomman`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=bommanrage&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else return api.sendMessage(`Tag của bạn nhập không tồn tại, vui lòng đọc hướng dẫn sử dụng trong ${prefix}help gif`, threadID, messageID);
		}

		//hug
		if (contentMessage.indexOf(`${prefix}hug`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/hug', (err, response, body) =>{
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 5, contentMessage.length).replace("@", "");
				let callback = function() {
					api.sendMessage({
						body: tag + ", I wanna hug you ❤️",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//kiss
		if (contentMessage.indexOf(`${prefix}kiss`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/kiss', (err, response, body) =>{
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 6, contentMessage.length).replace("@", "");
				let callback = function() {
					api.sendMessage({
						body: tag + ", I wanna kiss you ❤️",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//tát
		if (contentMessage.indexOf(`${prefix}slap`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/slap', (err, response, body) =>{
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 5, contentMessage.length).replace("@", "");
				let callback = function() {
					api.sendMessage({
						body: tag + ", take this slap 😈",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//meow
		if (contentMessage.indexOf(`${prefix}meow`) == 0)
			return request('http://aws.random.cat/meow', (err, response, body) =>{
				let picData = JSON.parse(body);
				let getURL = picData.file;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let callback = function() {
					api.sendMessage({
						attachment: fs.createReadStream(__dirname + `/src/meow.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/meow.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/meow.${ext}`)).on("close", callback);
			});

		//sauce
		if (contentMessage == `${prefix}sauce`) {
			const sagiri = require('sagiri'), search = sagiri(saucenao);
			if (event.type != "message_reply") return api.sendMessage(`Vui lòng bạn reply bức ảnh cần phải tìm!`, threadID, messageID);
			if (event.messageReply.attachments.length > 1) return api.sendMessage(`Vui lòng reply chỉ một ảnh!`, threadID, messageID);
			if (event.messageReply.attachments[0].type == 'photo') {
				if (saucenao == '' || typeof saucenao == 'undefined') return api.sendMessage(`Chưa có api của saucenao!`, threadID, messageID);
				return search(event.messageReply.attachments[0].url).then(response => {
					let data = response[0];
					let results = {
						similarity: data.similarity,
						material: data.raw.data.material || 'Không có',
						characters: data.raw.data.characters || 'Original',
						creator: data.raw.data.creator || 'Không biết',
						site: data.site,
						url: data.url
					};
					const minSimilarity = 50;
					if (minSimilarity <= ~~results.similarity) {
						api.sendMessage(
							'Đây là kết quả tìm kiếm được\n' +
							'-------------------------\n' +
							'- Độ tương tự: ' + results.similarity + '%\n' +
							'- Material: ' + results.material + '\n' +
							'- Characters: ' + results.characters + '\n' +
							'- Creator: ' + results.creator + '\n' +
							'- Original site: ' + results.site + ' - ' + results.url,
							threadID, messageID
						);
					}
					else api.sendMessage(`Không thấy kết quả nào trùng với ảnh bạn đang tìm kiếm :'(`, threadID, messageID);
				});
			}
		}

	/* ==================== General Commands ================*/
	
		//shortcut
		if (contentMessage.indexOf(`${prefix}short`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (!content) return api.sendMessage(`Không đúng format. Hãy tìm hiểu thêm tại ${prefix}help short.`, threadID, messageID);
			if (content.indexOf(`del`) == 0) {
				let delThis = contentMessage.slice(prefix.length + 10, contentMessage.length);
				if (!delThis) return api.sendMessage("Chưa nhập shortcut cần xóa.", threadID, messageID);
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					var oldData = JSON.parse(data);
					var getThread = oldData.find(item => item.id == threadID).shorts;
					if (!getThread.some(item => item.in == delThis)) return api.sendMessage("Shortcut này không tồn tại.", threadID, messageID);
					getThread.splice(getThread.findIndex(item => item.in === delThis), 1);
					fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage("Xóa shortcut thành công!", threadID, messageID));
				});
			}
			else if (content.indexOf(`all`) == 0) 
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					let allData = JSON.parse(data);
					let msg = '';
					if (!allData.some(item => item.id == threadID)) return api.sendMessage('Hiện tại không có shortcut nào.', threadID, messageID);
					if (allData.some(item => item.id == threadID)) {
						let getThread = allData.find(item => item.id == threadID).shorts;
						getThread.forEach(item => msg = msg + item.in + ' -> ' + item.out + '\n');
					}
					if (!msg) return api.sendMessage('Hiện tại không có shortcut nào.', threadID, messageID);
					msg = 'Tất cả shortcut đang có trong group là:\n' + msg;
					api.sendMessage(msg, threadID, messageID);
				});
			else {
				let narrow = content.indexOf(" => ");
				if (narrow == -1) return api.sendMessage(`Không đúng format. Hãy tìm hiểu thêm tại ${prefix}help short.`, threadID, messageID);
				let shortin = content.slice(0, narrow);
				let shortout = content.slice(narrow + 4, content.length);
				if (shortin == shortout) return api.sendMessage('Input và output giống nhau', threadID, messageID);
				if (!shortin) return api.sendMessage("Bạn chưa nhập input.", threadID, messageID);
				if (!shortout) return api.sendMessage("Bạn chưa nhập output.", threadID, messageID);
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					var oldData = JSON.parse(data);
					if (!oldData.some(item => item.id == threadID)) {
						let addThis = {
							id: threadID,
							shorts: []
						}
						addThis.shorts.push({ in: shortin, out: shortout });
						oldData.push(addThis);
						return fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage("Tạo shortcut mới thành công!", threadID, messageID));
					}
					else {
						let getShort = oldData.find(item => item.id == threadID);
						if (getShort.shorts.some(item => item.in == shortin)) return api.sendMessage("Shortcut này đã tồn tại trong group này!", threadID, messageID);
						getShort.shorts.push({ in: shortin, out: shortout });
						return fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage("Tạo shortcut mới thành công!", threadID, messageID));
					}
				});
			}
		}

		//wake time calculator
		if (contentMessage.indexOf(`${prefix}sleep`) == 0) {
			const moment = require("moment-timezone");
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var wakeTime = [];
			if (!content) {
				for (var i = 1; i < 7; i++) wakeTime.push(moment().utcOffset("+07:00").add(90 * i + 15, 'm').format("HH:mm"));
				return api.sendMessage("Nếu bạn đi ngủ bây giờ, những thời gian hoàn hảo nhất để thức dậy là:\n" + wakeTime.join(', ') + "\nFact: Thời gian để bạn vào giấc ngủ từ lúc nhắm mắt là 15-20 phút", threadID, messageID);
			}
			else {
				if (content.indexOf(":") == -1) return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);
				var contentHour = content.split(":")[0];
				var contentMinute = content.split(":")[1];
				if (isNaN(contentHour) || isNaN(contentMinute) || contentHour > 23 || contentMinute > 59 || contentHour < 0 || contentMinute < 0 || contentHour.length != 2 || contentMinute.length != 2)  return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);				var getTime = moment().utcOffset("+07:00").format();
				var time = getTime.slice(getTime.indexOf("T") + 1, getTime.indexOf("+"));
				var sleepTime = getTime.replace(time.split(":")[0] + ":", contentHour + ":").replace(time.split(":")[1] + ":", contentMinute + ":");
				for (var i = 1; i < 7; i++) wakeTime.push(moment(sleepTime).utcOffset("+07:00").add(90 * i + 15, 'm').format("HH:mm"));
				return api.sendMessage("Nếu bạn đi ngủ vào lúc " + content + ", những thời gian hoàn hảo nhất để thức dậy là:\n" + wakeTime.join(', ') + "\nFact: Thời gian để bạn vào giấc ngủ từ lúc nhắm mắt là 15-20 phút", threadID, messageID);
			}
		}

		//sleep time calculator
		if (contentMessage.indexOf(`${prefix}wake`) == 0) {
			const moment = require("moment-timezone");
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (content.indexOf(":") == -1) return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);
			var sleepTime = [];
			var contentHour = content.split(":")[0];
			var contentMinute = content.split(":")[1];
			if (isNaN(contentHour) || isNaN(contentMinute) || contentHour > 23 || contentMinute > 59 || contentHour < 0 || contentMinute < 0 || contentHour.length != 2 || contentMinute.length != 2)  return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);
			var getTime = moment().utcOffset("+07:00").format();
			var time = getTime.slice(getTime.indexOf("T") + 1, getTime.indexOf("+"));
			var wakeTime = getTime.replace(time.split(":")[0] + ":", contentHour + ":").replace(time.split(":")[1] + ":", contentMinute + ":");
			for (var i = 6; i > 0; i--) sleepTime.push(moment(wakeTime).utcOffset("+07:00").subtract(90 * i + 15, 'm').format("HH:mm"));
			return api.sendMessage("Nếu bạn muốn thức dậy vào lúc " + content + ", những thời gian hoàn hảo nhất để đi ngủ là:\n" + sleepTime.join(', ') + "\nFact: Thời gian để bạn vào giấc ngủ từ lúc nhắm mắt là 15-20 phút", threadID, messageID);
		}

		//prefix
		if (contentMessage == 'prefix') return api.sendMessage(`Prefix là: ${prefix}`, threadID, messageID);

		//credits
		if (contentMessage == "credits") return api.sendMessage("Project Mirai được thực hiện bởi:\nSpermLord: https://fb.me/MyNameIsSpermLord\nCatalizCS: https://fb.me/Cataliz2k\nFull source code at: https://github.com/roxtigger2003/mirai", threadID, messageID);

		//random name
		if (contentMessage.indexOf(`${prefix}rname`) == 0) return request(`https://uzby.com/api.php?min=4&max=12`, (err, response, body) => api.changeNickname(`${body}`, threadID, senderID));

		//simsimi
		if (contentMessage.indexOf(`${prefix}sim`) == 0) return request(`https://simsumi.herokuapp.com/api?text=${encodeURIComponent(contentMessage.slice(prefix.length + 4, contentMessage.length))}&lang=vi`, (err, response, body) => api.sendMessage((JSON.parse(body).success != '') ? JSON.parse(body).success : 'Không có câu trả nời nào.', threadID, messageID));

		//mit
		if (contentMessage.indexOf(`${prefix}mit`) == 0) return request(`https://kakko.pandorabots.com/pandora/talk-xml?input=${encodeURIComponent(contentMessage.slice(prefix.length + 4, contentMessage.length))}&botid=9fa364f2fe345a10&custid=${senderID}`, (err, response, body) => api.sendMessage((/<that>(.*?)<\/that>/.exec(body)[1]), threadID, messageID));

		//random màu cho theme chat
		if (contentMessage == `${prefix}randomcolor`) {
			var color = ['196241301102133', '169463077092846', '2442142322678320', '234137870477637', '980963458735625', '175615189761153', '2136751179887052', '2058653964378557', '2129984390566328', '174636906462322', '1928399724138152', '417639218648241', '930060997172551', '164535220883264', '370940413392601', '205488546921017', '809305022860427'];
			return api.changeThreadColor(color[Math.floor(Math.random() * color.length)], threadID, (err) => (err) ? api.sendMessage('Đã có lỗi không mong muốn đã xảy ra', threadID, messageID) : '');
		}

		//poll
		if (contentMessage.indexOf(`${prefix}poll`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			var title = content.slice(0, content.indexOf(" -> "));
			var options = content.substring(content.indexOf(" -> ") + 4)
			var option = options.split(" | ");
			var object = {};
			if (option.length == 1 && option[0].includes(' |')) option[0] = option[0].replace(' |', '');
			for (var i = 0; i < option.length; i++) object[option[i]] = false;
			return api.createPoll(title, threadID, object, (err) => (err) ? api.sendMessage("Có lỗi xảy ra vui lòng thử lại", threadID, messageID) : '');
		}

		//rainbow
		if (contentMessage.indexOf(`${prefix}rainbow`) == 0) {
			var value = contentMessage.slice(prefix.length + 8, contentMessage.length);
			if (isNaN(value)) return api.sendMessage('Dữ liệu không phải là một con số', threadID, messageID);
			if (value > 50) return api.sendMessage('Dữ liệu phải nhỏ hơn 50!', threadID, messageID);
			var color = ['196241301102133', '169463077092846', '2442142322678320', '234137870477637', '980963458735625', '175615189761153', '2136751179887052', '2058653964378557', '2129984390566328', '174636906462322', '1928399724138152', '417639218648241', '930060997172551', '164535220883264', '370940413392601', '205488546921017', '809305022860427'];
			for (var i = 0; i < value; i++) api.changeThreadColor(color[Math.floor(Math.random() * color.length)], threadID);
			return;
		}

		//giveaway
		if (contentMessage.indexOf(`${prefix}ga`) == 0) {
			var content = contentMessage.slice(prefix.length + 3, contentMessage.length);
			api.getThreadInfo(threadID, function(err, info) {
				if (err) return api.sendMessage(`Đã xảy ra lỗi không mong muốn`, threadID, messageID);
				let winner = info.participantIDs[Math.floor(Math.random() * info.participantIDs.length)];
				User.getName(winner).then((name) => {
					if (err) return api.sendMessage(`Đã xảy ra lỗi không mong muốn`, threadID, messageID);
					api.sendMessage({
						body: `Yahoo ${name}, bạn đã thắng giveaway! phần thưởng là: "${content}" 🥳🥳.`,
						mentions: [{
							tag: name,
							id: winner
						}]
					}, threadID, messageID);
				});
			});
			return;
		}

		//thời tiết
		if (contentMessage.indexOf(`${prefix}weather`) == 0) {
			var city = contentMessage.slice(prefix.length + 8, contentMessage.length);
			if (city.length == 0) return api.sendMessage(`Bạn chưa nhập địa điểm, hãy đọc hướng dẫn tại ${prefix}help weather!`,threadID, messageID);
			request(encodeURI("https://api.openweathermap.org/data/2.5/weather?q=" + city + "&appid=" + openweather + "&units=metric&lang=vi"), (err, response, body) => {
				if (err) throw err;
				var weatherData = JSON.parse(body);
				if (weatherData.cod !== 200) return api.sendMessage(`Địa điểm ${city} không tồn tại!`, threadID, messageID);
				var sunrise_date = moment.unix(weatherData.sys.sunrise).tz("Asia/Ho_Chi_Minh");
				var sunset_date = moment.unix(weatherData.sys.sunset).tz("Asia/Ho_Chi_Minh");
				api.sendMessage({
					body: '🌡 Nhiệt độ: ' + weatherData.main.temp + '°C' + '\n' +
								'🌡 Nhiệt độ cơ thể cảm nhận được: ' + weatherData.main.feels_like + '°C' + '\n' +
								'☁️ Bầu trời hiện tại: ' + weatherData.weather[0].description + '\n' +
								'💦 Độ ẩm: ' + weatherData.main.humidity + '%' + '\n' +
								'💨 Tốc độ gió: ' + weatherData.wind.speed + 'km/h' + '\n' +
								'🌅 Mặt trời mọc vào lúc: ' + sunrise_date.format('HH:mm:ss') + '\n' +
								'🌄 Mặt trời lặn vào lúc: ' + sunset_date.format('HH:mm:ss') + '\n',
					location: {
						latitude: weatherData.coord.lat,
						longitude: weatherData.coord.lon,
						current: true
					},
				}, threadID, messageID);
			});
			return;
		}

		//say
		if (contentMessage.indexOf(`${prefix}say`) == 0) {
			var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 4, contentMessage.length);
			var languageToSay = (["ru","en","ko","ja"].some(item => content.indexOf(item) == 0)) ? content.slice(0, content.indexOf(" ")) : 'vi';
			var msg = (languageToSay != 'vi') ? content.slice(3, contentMessage.length) : content;
			var callback = () => api.sendMessage({body: "", attachment: fs.createReadStream(__dirname + "/src/say.mp3")}, threadID, () => fs.unlinkSync(__dirname + "/src/say.mp3"));
			return request(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(msg)}&tl=${languageToSay}&client=tw-ob`).pipe(fs.createWriteStream(__dirname+'/src/say.mp3')).on('close',() => callback());
		}

		//cập nhật tình hình dịch
		if (contentMessage == `${prefix}covid-19`)
			return request("https://code.junookyo.xyz/api/ncov-moh/data.json", (err, response, body) => {
				if (err) throw err;
				var data = JSON.parse(body);
				api.sendMessage(
					"Thế giới:" +
					"\n- Nhiễm: " + data.data.global.cases +
					"\n- Chết: " + data.data.global.deaths +
					"\n- Hồi phục: " + data.data.global.recovered +
					"\nViệt Nam:" +
					"\n- Nhiễm: " + data.data.vietnam.cases +
					"\n- Chết: " + data.data.vietnam.deaths +
					"\n- Phục hồi: " + data.data.vietnam.recovered,
					threadID, messageID
				);
			});

		//chọn
		if (contentMessage.indexOf(`${prefix}choose`) == 0) {
			var input = contentMessage.slice(prefix.length + 7, contentMessage.length).trim();
			if (!input)return api.sendMessage(`Bạn không nhập đủ thông tin kìa :(`,threadID,messageID);
			var array = input.split(" | ");
			return api.sendMessage(`Hmmmm, em sẽ chọn giúp cho là: ` + array[Math.floor(Math.random() * array.length)] + `.`,threadID,messageID);
		}

		//waifu
		if (contentMessage == `${prefix}waifu`) {
			var route = Math.round(Math.random() * 10);
			if (route == 1 || route == 0 || route == 3) return api.sendMessage("Dạ em sẽ làm vợ anh <3\nYêu chàng nhiều <3", threadID, messageID);
			else if (route == 2 || route > 4) return api.sendMessage("Chúng ta chỉ là bạn thôi :'(", threadID, messageID);
		}

		//ramdom con số
		if (contentMessage.indexOf(`${prefix}roll`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (!content) return api.sendMessage(`uwu con số đẹp nhất em chọn được là: ${Math.floor(Math.random() * 99)}`, threadID, messageID);
			var splitContent = content.split(" ");
			if (splitContent.length != 2) return api.sendMessage(`Sai format, bạn hãy đọc hướng dẫn trong ${prefix}help roll để biết thêm chi tiết.`, threadID, messageID)
			var min = parseInt(splitContent[0]);
			var max = parseInt(splitContent[1]);
			if (isNaN(min) || isNaN(max)) return api.sendMessage('Dữ liệu bạn nhập không phải là một con số.', threadID, messageID);
			if (min >= max) return api.sendMessage('Oops, số kết thúc của bạn lớn hơn hoặc bằng số bắt đầu.', threadID, messageID);
			return api.sendMessage(`uwu con số đẹp nhất em chọn được là: ${Math.floor(Math.random() * (max - min + 1) + min)}`, threadID, messageID);
		}

		//Khiến bot nhái lại tin nhắn bạn
		if (contentMessage.indexOf(`${prefix}echo`) == 0) return api.sendMessage(contentMessage.slice(prefix.length + 5, contentMessage.length), threadID);

		//rank
		if (contentMessage.indexOf(`${prefix}rank`) == 0) {
			const createCard = require("../controllers/rank_card.js");
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (content.length == 0)
				(async () => {
					let name = await User.getName(senderID);
					Rank.getPoint(senderID).then(point => createCard({ id: senderID, name, ...point })).then(path => api.sendMessage({attachment: fs.createReadStream(path)}, threadID, () => fs.unlinkSync(path), messageID))
				})();
			else if (content.indexOf("@") !== -1)
				for (var i = 0; i < Object.keys(event.mentions).length; i++) {
					let uid = Object.keys(event.mentions)[i];
					(async () => {
						let name = await User.getName(uid);
						Rank.getPoint(uid).then(point => createCard({ id: uid, name, ...point })).then(path => api.sendMessage({attachment: fs.createReadStream(path)}, threadID, () => fs.unlinkSync(path), messageID))
					})();
				}
			return;
		}

		//dịch ngôn ngữ
		if (contentMessage.indexOf(`${prefix}trans`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (content.length == 0 && event.type != "message_reply") return api.sendMessage(`Bạn chưa nhập thông tin, vui lòng đọc ${prefix}help để biết thêm chi tiết!`, threadID,messageID);
			var translateThis = content.slice(0, content.indexOf(" ->"));
			var lang = content.substring(content.indexOf(" -> ") + 4);
			if (event.type == "message_reply") {
				translateThis = event.messageReply.body
				if (content.indexOf(" -> ") != -1) lang = content.substring(content.indexOf(" -> ") + 4);
				else lang = 'vi';
			}
			else if (content.indexOf(" -> ") == -1) {
				translateThis = content.slice(0, content.length)
				lang = 'vi';
			}
			return request(encodeURI(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${translateThis}`), (err, response, body) => {
				if (err) return api.sendMessage("Đã có lỗi xảy ra!", threadID, messageID)
				var retrieve = JSON.parse(body);
				var fromLang = retrieve[0][0][8][0][0][1].split("_")[0];
				api.sendMessage(`Bản dịch: ${retrieve[0][0][0]}\n - được dịch từ ${fromLang} sang ${lang}`, threadID, messageID);
			});
		}

		//uptime
		if (contentMessage == `${prefix}uptime`) {
			var time = process.uptime();
			var hours = Math.floor(time / (60*60));
			var minutes = Math.floor((time % (60 * 60)) / 60);
			var seconds = Math.floor(time % 60);
			return api.sendMessage("Bot đã hoạt động được " + hours + " giờ " + minutes + " phút " + seconds + " giây.", threadID, messageID);
		}

		//unsend message
		if (contentMessage.indexOf(`${prefix}gỡ`) == 0) {
			if (event.messageReply.senderID != api.getCurrentUserID()) return api.sendMessage("Không thể gỡ tin nhắn của người khác", threadID, messageID);
			if (event.type != "message_reply") return api.sendMessage("Phản hồi tin nhắn cần gỡ", threadID, messageID);
			return api.unsendMessage(event.messageReply.messageID, err => (err) ? api.sendMessage("Không thể gỡ tin nhắn này vì đã quá 10 phút!", threadID, messageID) : '');
		}

		//get uid
		if (contentMessage.indexOf(`${prefix}uid`) == 0) {
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			if (!content) return api.sendMessage(`${senderID}`, threadID, messageID);
			else if (content.indexOf("@") !== -1) {
				for (var i = 0; i < Object.keys(event.mentions).length; i++) api.sendMessage(`${Object.keys(event.mentions)[i]}`, threadID, messageID);
				return;
			}
		}

		//wiki
		if (contentMessage.indexOf(`${prefix}wiki`) == 0) {
			const wiki = require("wikijs").default;
			var url = 'https://vi.wikipedia.org/w/api.php';
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (contentMessage.indexOf("-en") == 6) {
				url = 'https://en.wikipedia.org/w/api.php';
				content = contentMessage.slice(prefix.length + 9, contentMessage.length);
			}
			if (!content) return api.sendMessage("Nhập thứ cần tìm!", threadID, messageID);
			return wiki({apiUrl: url}).page(content).catch((err) => api.sendMessage("Không tìm thấy " + content, threadID, messageID)).then(page => (typeof page != 'undefined') ? Promise.resolve(page.summary()).then(val => api.sendMessage(val, threadID, messageID)) : '');
		}

		//ping
		if (contentMessage == `${prefix}ping`)
			return api.getThreadInfo(threadID, (err, info) => {
				if (err) return api.sendMessage('Đã có lỗi xảy ra!.', threadID, messageID);
				var ids = info.participantIDs;
				ids.splice(ids.indexOf(api.getCurrentUserID()), 1);
				var body = '@everyone', mentions = [];
				for (let i = 0; i < ids.length; i++) {
					if (i == body.length) body += 'e';
					mentions.push({
						tag: body[i],
						id: ids[i],
						fromIndex: i
					});
				}
				api.sendMessage({body, mentions}, threadID, messageID);
			});

		//look earth
		if (contentMessage == `${prefix}earth`)
			return request(`https://api.nasa.gov/EPIC/api/natural/images?api_key=DEMO_KEY`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				var randomNumber = Math.floor(Math.random() * ((jsonData.length -1) + 1));
				var image_name = jsonData[randomNumber].image
				var date = jsonData[randomNumber].date;
				var date_split = date.split("-")
				var year = date_split[0];
				var month = date_split[1];
				var day_and_time = date_split[2];
				var sliced_date = day_and_time.slice(0, 2);
				var image_link = `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${sliced_date}/png/` + image_name + ".png";
				let callback = function() {
					api.sendMessage({
						body: `${jsonData[randomNumber].caption} on ${date}`,
						attachment: fs.createReadStream(__dirname + `/src/randompic.png`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/randompic.png`), messageID);
				};
				request(image_link).pipe(fs.createWriteStream(__dirname + `/src/randompic.png`)).on("close", callback);
			});

		//localtion iss
		if (contentMessage == `${prefix}iss`) {
			return request(`http://api.open-notify.org/iss-now.json`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				api.sendMessage(`Vị trí hiện tại của International Space Station 🌌🌠🌃\nVĩ độ: ${jsonData.iss_position.latitude} | Kinh độ: ${jsonData.iss_position.longitude}`, threadID, messageID);
			});
		}

		//near-earth obj
		if (contentMessage == `${prefix}neo`) {
			return request(`https://api.nasa.gov/neo/rest/v1/feed/today?detailed=true&api_key=DEMO_KEY`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				api.sendMessage(`Hiện tại đang có tổng cộng: ${jsonData.element_count} vật thể đang ở gần trái đất ngay lúc này!`, threadID, messageID);
			});
		}

		//spacex
		if (contentMessage == `${prefix}spacex`) {
			return request(`https://api.spacexdata.com/v3/launches/latest`, (err, response, body) => {
				if (err) throw err;
				var data = JSON.parse(body);
				api.sendMessage(
					"Thông tin đợt phóng mới nhất của SpaceX:" +
					"\n- Mission: " + data.mission_name +
					"\n- Năm phóng: " + data.launch_year +
					"\n- Thời gian phóng: " + data.launch_date_local +
					"\n- Tên lửa: " + data.rocket.rocket_name +
					"\n- Link Youtube: " + data.links.video_link,
				threadID, messageID);
			});
		}

		//afk
		if (contentMessage.indexOf(`${prefix}afk`) == 0) {
			(async () => {
				var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
				if (content) {
					await User.updateReason(senderID, content);
					api.sendMessage(`🛠 | Bạn đã bật mode afk với lý do: ${content}`, threadID, messageID);
				}
				else {
					await User.updateReason(senderID, 'none');
					api.sendMessage(`🛠 | Bạn đã bật mode afk`, threadID, messageID);
				}
				await User.afk(senderID);
				__GLOBAL.afkUser.push(parseInt(senderID));
			})();
			return;
		}

		/* ==================== Study Commands ==================== */

		//toán học
		if (contentMessage.indexOf(`${prefix}math`) == 0) {
			const wolfram = "http://api.wolframalpha.com/v2/result?appid=" + wolfarm + "&i=";
			var m = contentMessage.slice(prefix.length + 5, contentMessage.length);
			request(wolfram + encodeURIComponent(m), function(err, response, body) {
				if (body.toString() === "Wolfram|Alpha did not understand your input") return api.sendMessage("Tôi chả hiểu bạn đang đưa thứ gì cho tôi nữa", threadID, messageID);
				else if (body.toString() === "Wolfram|Alpha did not understand your input") return api.sendMessage("Tôi không hiểu câu hỏi của bạn", threadID, messageID);
				else if (body.toString() === "My name is Wolfram Alpha.") return api.sendMessage("Tên tôi là Mirai", threadID, messageID);
				else if (body.toString() === "I was created by Stephen Wolfram and his team.") return api.sendMessage("Tôi được làm ra bởi CatalizCS và SpermLord", threadID, messageID);
				else if (body.toString() === "I am not programmed to respond to this dialect of English.") return api.sendMessage("Tôi không được lập trình để nói những thứ như này", threadID, messageID);
				else if (body.toString() === "StringJoin(CalculateParse`Content`Calculate`InternetData(Automatic, Name))") return api.sendMessage("Tôi không biết phải trả lời như nào", threadID, messageID);
				else return api.sendMessage(body, threadID, messageID);
			});
		}

		//cân bằng phương trình hóa học
		if (contentMessage.indexOf(`${prefix}chemeb`) == 0) {
			console.log = () => {};
			const chemeb = require('chem-eb');
			if (event.type == "message_reply") {
				var msg = event.messageReply.body;
				if (msg.includes('(') && msg.includes(')')) return api.sendMessage('Hiện tại không hỗ trợ phương trình tối giản. Hãy chuyển (XY)z về dạng XzYz.', threadID, messageID);
				var balanced = chemeb(msg);
				return api.sendMessage(`✅ ${balanced.outChem}`, threadID, messageID);
			}
			else {
				var msg = contentMessage.slice(prefix.length + 7, contentMessage.length);
				if (msg.includes('(') && msg.includes(')')) return api.sendMessage('Hiện tại không hỗ trợ phương trình tối giản. Hãy chuyển (XY)z về dạng XzYz.', threadID, messageID);
				var balanced = chemeb(msg);
				return api.sendMessage(`✅ ${balanced.outChem}`, threadID, messageID);
			}
		}

	/* ==================== NSFW Commands ==================== */

		//nhentai search
		if (contentMessage.indexOf(`${prefix}nhentai`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			let id = contentMessage.slice(prefix.length + 8, contentMessage.length).trim();
			if (!id) return api.sendMessage(`Code lý tưởng để bắn tung toé là: ${Math.floor(Math.random() * 99999)}`, threadID, messageID);
			return request(`https://nhentai.net/api/gallery/${id}`, (error, response, body) => {
				var codeData = JSON.parse(body);
				if (codeData.error == true) return api.sendMessage("Không tìm thấy truyện này", threadID, messageID);
				let title = codeData.title.pretty;
				let tagList = [];
				let artistList = [];
				let characterList = [];
				codeData.tags.forEach(item => (item.type == "tag") ? tagList.push(item.name) : (item.type == "artist") ? artistList.push(item.name) : (item.type == "character") ? characterList.push(item.name) : '');
				var tags = tagList.join(', ');
				var artists = artistList.join(', ');
				var characters = characterList.join(', ');
				if (characters == '') characters = 'Original';
				api.sendMessage("Tiêu đề: " + title, threadID, () => {
					api.sendMessage("Tác giả: " + artists, threadID, () => {
						api.sendMessage("Nhân vật: " + characters, threadID, () => {
							api.sendMessage("Tags: " + tags, threadID, () => {
								api.sendMessage("Link: https://nhentai.net/g/" + id, threadID);
							});
						});
					});
				}, messageID);
			});
		}

		//hentaivn
		if (contentMessage.indexOf(`${prefix}hentaivn`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			const cheerio = require('cheerio');
			var id = contentMessage.slice(prefix.length + 9, contentMessage.length);
			if (!id) return api.sendMessage("Nhập id!", threadID, messageID);
			if (!id) return api.sendMessage(`Code lý tưởng để bắn tung toé là: ${Math.floor(Math.random() * 21553)}`, threadID, messageID);
			axios.get(`https://hentaivn.net/id${id}`).then((response) => {
				if (response.status == 200) {
					const html = response.data;
					const $ = cheerio.load(html);
					var getContainer = $('div.container');
					var getURL = getContainer.find('form').attr('action');
					if (getURL == `https://hentaivn.net/${id}-doc-truyen-.html`) return api.sendMessage("Không tìm thấy truyện này", threadID, messageID);
					axios.get(getURL).then((response) => {
						if (response.status == 200) {
							const html = response.data;
							const $ = cheerio.load(html);
							var getInfo = $('div.container div.main div.page-info');
							var getUpload = $('div.container div.main div.page-uploader');
							var getName = getInfo.find('h1').find('a').text();
							var getTags = getInfo.find('a.tag').contents().map(function() {
								return (this.type === 'text') ? $(this).text() + '' : '';
							}).get().join(', ');
							var getArtist = getInfo.find('a[href^="/tacgia="]').contents().map(function () {
								return (this.type === 'text') ? $(this).text() + '' : '';
							}).get().join(', ');
							var getChar = getInfo.find('a[href^="/char="]').contents().map(function () {
								return (this.type === 'text') ? $(this).text() + '' : '';
							}).get().join(', ');
							if (getChar == '') getChar = 'Original';
							var getLikes = getUpload.find('div.but_like').text();
							var getDislikes = getUpload.find('div.but_unlike').text();
							return api.sendMessage("Tên: " + getName.substring(1), threadID, () => {
								api.sendMessage("Tác giả: " + getArtist, threadID, () => {
									api.sendMessage("Nhân vật: " + getChar, threadID, () => {
										api.sendMessage("Tags: " + getTags, threadID, () => {
											api.sendMessage("Số Like: " + getLikes.substring(1) + "\nSố Dislike: " + getDislikes.substring(1), threadID, () => {
												api.sendMessage(getURL.slice(0, 17) + " " + getURL.slice(17), threadID);
											});
										});
									});
								});
							}, messageID);
						}
					}, (error) => console.log(error));
				}
			}, (error) => console.log(error));
			return;
		}

		//porn pics
		if (contentMessage.indexOf(`${prefix}porn`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			return Nsfw.pornUseLeft(senderID).then(useLeft => {
				if (useLeft == 0) return api.sendMessage(`Bạn đã hết số lần dùng ${prefix}porn.\nHãy nâng cấp lên Hạng NSFW cao hơn hoặc chờ đến ngày mai.`, threadID, messageID);
				const cheerio = require('cheerio');
				const ffmpeg = require("fluent-ffmpeg");
				const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
				ffmpeg.setFfmpegPath(ffmpegPath);
				var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
				var album = {
					'asian': "9057591",
					'ass': "2830292",
					'bdsm': "17510771",
					'bj': "3478991",
					'boobs': "15467902",
					'cum': "1036491",
					'feet': "852341",
					'gay': "19446301",
					'pornstar': "20404671",
					'pussy': "1940602",
					'sex': "2132332",
					'teen': "17887331"
				};
				if (!content || !album.hasOwnProperty(content)) {
					let allTags = [];
					Object.keys(album).forEach((item) => allTags.push(item));
					var pornTags = allTags.join(', ');
					return api.sendMessage('=== Tất cả các tag Porn ===\n' + pornTags, threadID, messageID);
				}
				axios.get(`https://www.pornhub.com/album/${album[content]}`).then((response) => {
					if (useLeft != -1) Nsfw.subtractPorn(senderID);
					if (response.status == 200) {
						const html = response.data;
						const $ = cheerio.load(html);
						var result = [];
						let list = $('ul.photosAlbumsListing li.photoAlbumListContainer div.photoAlbumListBlock');
						list.map(index => {
							let item = list.eq(index);
							if (!item.length) return;
							let photo = `${item.find('a').attr('href')}`;
							result.push(photo);
						});
						let getURL = "https://www.pornhub.com" + result[Math.floor(Math.random() * result.length)];
						axios.get(getURL).then((response) => {
							if (response.status == 200) {
								const html = response.data;
								const $ = cheerio.load(html);
								if (content == 'sex') {
									let video = $('video.centerImageVid');
									let mp4URL = video.find('source').attr('src');
									let ext = mp4URL.substring(mp4URL.lastIndexOf('.') + 1);
									request(mp4URL).pipe(fs.createWriteStream(__dirname + `/src/porn.${ext}`)).on('close', () => {
										ffmpeg().input(__dirname + `/src/porn.${ext}`).toFormat("gif").pipe(fs.createWriteStream(__dirname + "/src/porn.gif")).on("close", () => {
											return api.sendMessage({attachment: fs.createReadStream(__dirname + `/src/porn.gif`)}, threadID, () => {
												fs.unlinkSync(__dirname + `/src/porn.gif`);
												fs.unlinkSync(__dirname + `/src/porn.${ext}`);
											}, messageID);
										});
									});
								}
								else {
									let image = $('div#photoWrapper');
									let imgURL = image.find('img').attr('src');
									let ext = imgURL.substring(imgURL.lastIndexOf('.') + 1);
									return request(imgURL).pipe(fs.createWriteStream(__dirname + `/src/porn.${ext}`)).on('close', () => api.sendMessage({attachment: fs.createReadStream(__dirname + `/src/porn.${ext}`)}, threadID, () => fs.unlinkSync(__dirname + `/src/porn.${ext}`), messageID));
								}
							}
						}, (error) => console.log(error));
					}
					else return api.sendMessage("Đã xảy ra lỗi!", threadID, messageID);
				}, (error) => console.log(error));
			});
		}

		//hentai
		if (contentMessage.indexOf(`${prefix}hentai`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			return Nsfw.hentaiUseLeft(senderID).then(useLeft => {
				if (useLeft == 0) return api.sendMessage(`Bạn đã hết số lần dùng ${prefix}hentai.\nHãy nâng cấp lên Hạng NSFW cao hơn hoặc chờ đến ngày mai.`, threadID, messageID);
				var content = contentMessage.slice(prefix.length + 7, contentMessage.length);
				var jsonData = fs.readFileSync(__dirname + "/src/anime.json");
				var data = JSON.parse(jsonData).nsfw;
				if (!content || !data.hasOwnProperty(content)) {
					let nsfwList = [];
					Object.keys(data).forEach(endpoint => nsfwList.push(endpoint));
					let nsfwTags = nsfwList.join(', ');
					return api.sendMessage('=== Tất cả các tag Hentai ===\n' + nsfwTags, threadID, messageID);
				}
				request(data[content], (error, response, body) => {
					if (useLeft != -1) Nsfw.subtractHentai(senderID);
					let picData = JSON.parse(body);
					let getURL = picData.data.response.url;
					let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
					request(getURL).pipe(fs.createWriteStream(__dirname + `/src/hentai.${ext}`)).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + `/src/hentai.${ext}`)}, threadID, () => fs.unlinkSync(__dirname + `/src/hentai.${ext}`), messageID));
				});
			});
		}

		//get nsfw tier
		if (contentMessage == `${prefix}mynsfw`) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			(async () => {
				let tier = await Nsfw.getNSFW(senderID);
				let hentai = await Nsfw.hentaiUseLeft(senderID);
				let porn = await Nsfw.pornUseLeft(senderID);
				if (tier == -1) api.sendMessage('Bạn đang ở God Mode.\nBạn sẽ không bị giới hạn số lần dùng lệnh NSFW.', threadID, messageID);
				else api.sendMessage(`Hạng NSFW của bạn là ${tier}.\nSố lần sử dụng ${prefix}porn còn lại: ${porn}.\nSố lần sử dụng ${prefix}hentai còn lại: ${hentai}.`, threadID, messageID);
			})();
			return;
		}

		//buy nsfw tier
		if (contentMessage == `${prefix}buynsfw`) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			(async () => {
				let tier = await Nsfw.getNSFW(senderID);
				if (tier == -1) api.sendMessage('Bạn đang ở God Mode nên sẽ không thể mua.', threadID, messageID);
				else {
					let buy = await Nsfw.buyNSFW(senderID);
					if (buy == false) api.sendMessage('Đã có lỗi xảy ra!', threadID, messageID);
					else api.sendMessage(buy.toString(), threadID, messageID);
				}
			})();
			return;
		}

		//set nsfw tier
		if (contentMessage.indexOf(`${prefix}setnsfw`) == 0 && admins.includes(senderID)) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			var mention = Object.keys(event.mentions)[0];
			var content = contentMessage.slice(prefix.length + 8, contentMessage.length);
			var sender = content.slice(0, content.lastIndexOf(" "));
			var tierSet = content.substring(content.lastIndexOf(" ") + 1);
			return Economy.getMoney(senderID).then((moneydb) => {
				if (isNaN(tierSet)) return api.sendMessage('Số hạng NSFW cần set của bạn không phải là 1 con số!', threadID, messageID);
				if (tierSet > 5 || tierSet < -1) return api.sendMessage('Hạng NSFW không được dưới -1 và vượt quá 5', threadID, messageID);
				if (tierSet == -1 && nsfwGodMode == false) return api.sendMessage('Bạn chưa bật NSFW God Mode trong config.', threadID, messageID);
				if (!mention && sender == 'me' && tierSet != -1) return api.sendMessage("Đã sửa hạng NSFW của bản thân thành " + tierSet, threadID, () => Economy.setNSFW(senderID, parseInt(tierSet)), messageID);
				if (!mention && sender == 'me' && tierSet == -1) return api.sendMessage("Đã bật God Mode cho bản thân!\nBạn sẽ không bị trừ số lần sử dụng lệnh NSFW.", threadID, () => Economy.setNSFW(senderID, parseInt(tierSet)), messageID);
				if (sender != 'me' && tierSet != -1)
					api.sendMessage({
						body: `Bạn đã sửa hạng NSFW của ${event.mentions[mention].replace("@", "")} thành ${tierSet}.`,
						mentions: [{
							tag: event.mentions[mention].replace("@", ""),
							id: mention
						}]
					}, threadID, () => Nsfw.setNSFW(mention, parseInt(tierSet)), messageID);
				if (senderID != 'me' && tierSet == -1)
					api.sendMessage({
						body: `Bạn đã bật God Mode cho ${event.mentions[mention].replace("@", "")}!\nGiờ người này có thể dùng lệnh NSFW mà không bị giới hạn!`,
						mentions: [{
							tag: event.mentions[mention].replace("@", ""),
							id: mention
						}]
					}, threadID, () => Nsfw.setNSFW(mention, parseInt(tierSet)), messageID);
			});
		}

		/* ==================== Economy and Minigame Commands ==================== */

		//coinflip
		if (contentMessage.indexOf(`${prefix}coinflip`) == 0) return (Math.random() > 0.5) ? api.sendMessage("Mặt ngửa!", threadID, messageID) : api.sendMessage("Mặt sấp!", threadID, messageID);

		//money
		if (contentMessage.indexOf(`${prefix}money`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var mention = Object.keys(event.mentions)[0];
			if (!content) return Economy.getMoney(senderID).then((moneydb) => api.sendMessage(`Số tiền của bạn hiện đang có là: ${moneydb} đô`, threadID, messageID));
			else if (content.indexOf("@") !== -1)
				return Economy.getMoney(mention).then((moneydb) => {
					api.sendMessage({
						body: `Số tiền của ${event.mentions[mention].replace("@", "")} hiện đang có là: ${moneydb} đô.`,
						mentions: [{
							tag: event.mentions[mention].replace("@", ""),
							id: mention
						}]
					}, threadID, messageID);
				});
		}

		//daily gift
		if (contentMessage == `${prefix}daily`) {
			let cooldown = 8.64e7;
			return Economy.getDailyTime(senderID).then((lastDaily) => {
				if (lastDaily !== null && cooldown - (Date.now() - lastDaily) > 0) {
					let time = ms(cooldown - (Date.now() - lastDaily));
					api.sendMessage("Bạn đã nhận phần thưởng của ngày hôm nay, vui lòng quay lại sau: " + time.hours + " giờ " + time.minutes + " phút " + time.seconds + " giây ", threadID, messageID);
				}
				else
					api.sendMessage("Bạn đã nhận phần thưởng của ngày hôm nay. Cố gắng lên nhé <3", threadID, () => {
						Economy.addMoney(senderID, 200);
						Economy.updateDailyTime(senderID, Date.now());
						modules.log("User: " + senderID + " nhận daily thành công!");
					}, messageID);
			});
		}

		if (contentMessage == `${prefix}work`) {
			return Economy.getWorkTime(senderID).then((lastWork) => {
				let cooldown = 1200000;
				if (lastWork !== null && cooldown - (Date.now() - lastWork) > 0) {
					let time = ms(cooldown - (Date.now() - lastWork));
					api.sendMessage("Bạn đã thăm ngàn, để tránh bị kiệt sức vui lòng quay lại sau: " + time.minutes + " phút " + time.seconds + " giây ", threadID, messageID);
				}
				else {
					let job = [
						"bán vé số",
						"sửa xe",
						"lập trình",
						"hack facebook",
						"thợ sửa ống nước ( ͡° ͜ʖ ͡°)",
						"đầu bếp",
						"thợ hồ",
						"fake taxi",
						"gangbang người khác",
						"re sờ chym mờ",
						"bán hàng online",
						"nội trợ",
						"vả mấy thằng sao đỏ, giun vàng",
						"bán hoa",
						"tìm jav/hentai code cho SpermLord",
						"chơi Yasuo trong rank và gánh team"
					];
					let amount = Math.floor(Math.random() * 400);
					api.sendMessage(`Bạn đã làm công việc: "${job[Math.floor(Math.random() * job.length)]}" và đã nhận được số tiền là: ${amount} đô`, threadID, () => {
						Economy.addMoney(senderID, parseInt(amount));
						Economy.updateWorkTime(senderID, Date.now());
						modules.log("User: " + senderID + " nhận job thành công!");
					}, messageID);
				}
			});
		}

		//roulette
		if (contentMessage.indexOf(`${prefix}roul`) == 0) {
			return Economy.getMoney(senderID).then(function(moneydb) {
				var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
				if (!content) return api.sendMessage(`Bạn chưa nhập thông tin đặt cược!`, threadID, messageID);
				var color = content.split(" ")[0];
				var money = content.split(" ")[1];
				if (isNaN(money) || money.indexOf("-") !== -1) return api.sendMessage(`Số tiền đặt cược của bạn không phải là một con số, vui lòng xem lại cách sử dụng tại ${prefix}help roul`, threadID, messageID);
				if (!money || !color) return api.sendMessage("Sai format", threadID, messageID);
				if (money > moneydb) return api.sendMessage(`Số tiền của bạn không đủ`, threadID, messageID);
				if (money < 50) return api.sendMessage(`Số tiền đặt cược của bạn quá nhỏ, tối thiểu là 50 đô`, threadID, messageID);
				var check = (num) => (num == 0) ? '💙' : (num % 2 == 0 && num % 6 != 0 && num % 10 != 0) ? '♥️' : (num % 3 == 0 && num % 6 != 0) ? '💚' : (num % 5 == 0 && num % 10 != 0) ? '💛' : (num % 10 == 0) ? '💜' : '🖤️';
				let random = Math.floor(Math.random() * 50);
				
				if (color == "e" || color == "blue") color = 0;
				else if (color == "r" || color == "red") color = 1;
				else if (color == "g" || color == "green") color = 2;
				else if (color == "y" || color == "yellow") color = 3;
				else if (color == "v" || color == "violet") color = 4;
				else if (color == "b" || color == "black") color = 5;
				else return api.sendMessage("Bạn chưa nhập thông tin cá cược!, black [x0.5] red [x1] green [x1.25] yellow [x1.5] violet [x1.75] blue [x2]", threadID, messageID);
				
				if (color == 0 && check(random) == '💙') api.sendMessage(`Bạn đã chọn màu 💙, bạn đã thắng với số tiền được nhân lên 2: ${money * 2} đô\nSố tiền hiện tại của bạn là: ${moneydb + (money * 2)} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money * 2)), messageID);
				else if (color == 1 && check(random) == '♥️') api.sendMessage(`Bạn đã chọn màu ♥️, bạn đã thắng với số tiền nhân lên 1.75: ${money * 1.75} đô\nSố tiền hiện tại của bạn là: ${moneydb + (money * 1.75)} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money * 1.75)), messageID);
				else if (color == 2 && check(random) == '💚') api.sendMessage(`Bạn đã chọn màu 💚, bạn đã thắng với số tiền nhân lên 1.5: ${money * 1.5} đô\nSố tiền hiện tại của bạn là: ${moneydb + (money * 1.5)} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money * 1.5)), messageID);
				else if (color == 3 && check(random) == '💛') api.sendMessage(`Bạn đã chọn màu 💛, bạn đã thắng với số tiền nhân lên 1.25: ${money * 1.25} đô\nSố tiền hiện tại của bạn là: ${moneydb + (money * 1.25)} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money * 1.25)), messageID);
				else if (color == 4 && check(random) == '💜') api.sendMessage(`Bạn đã chọn màu 💜, bạn đã thắng với số tiền nhân lên 1: ${money} đô\nSố tiền hiện tại của bạn là: ${moneydb + money} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money)), messageID);
				else if (color == 5 && check(random) == '🖤️') api.sendMessage(`Bạn đã chọn màu 🖤️, bạn đã thắng với số tiền nhân lên 0.5: ${money * 0.5} đô\nSố tiền hiện tại của bạn là: ${moneydb + (money * 0.5)} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money * 0.5)), messageID);
				else api.sendMessage(`Màu ${check(random)}\nBạn đã ra đê ở và mất trắng số tiền: ${money} đô :'(\nSố tiền hiện tại của bạn là: ${moneydb - money} đô.`, threadID, () => Economy.subtractMoney(senderID, money), messageID)
			});
		}

		//slot
		if (contentMessage.indexOf(`${prefix}sl`) == 0) {
			const slotItems = ["🍇","🍉","🍊","🍏","7⃣","🍓","🍒","🍌","🥝","🥑","🌽"];
			return Economy.getMoney(senderID).then((moneydb) => {
				var money = contentMessage.slice(prefix.length + 3, contentMessage.length);
				if (!money) return api.sendMessage(`Bạn chưa nhập số tiền đặt cược!`, threadID, messageID);
				let win = false;
				if (isNaN(money)|| money.indexOf("-") !== -1) return api.sendMessage(`Số tiền đặt cược của bạn không phải là một con số, vui lòng xem lại cách sử dụng tại ${prefix}help sl`, threadID, messageID);
				if (!money) return api.sendMessage("Chưa nhập số tiền đặt cược!", threadID, messageID);
				if (money > moneydb) return api.sendMessage(`Số tiền của bạn không đủ`, threadID, messageID);
				if (money < 50) return api.sendMessage(`Số tiền đặt cược của bạn quá nhỏ, tối thiểu là 50 đô!`, threadID, messageID);
				let number = [];
				for (i = 0; i < 3; i++) number[i] = Math.floor(Math.random() * slotItems.length);
				if (number[0] == number[1] && number[1] == number[2]) {
					money *= 9;
					win = true;
				}
				else if (number[0] == number[1] || number[0] == number[2] || number[1] == number[2]) {
					money *= 2;
					win = true;
				}
				(win) ? api.sendMessage(`${slotItems[number[0]]} | ${slotItems[number[1]]} | ${slotItems[number[2]]}\n\nBạn đã thắng, toàn bộ ${money} đô thuộc về bạn. Số tiền hiện tại bạn có: ${moneydb + money}`, threadID, () => Economy.addMoney(senderID, parseInt(money)), messageID) : api.sendMessage(`${slotItems[number[0]]} | ${slotItems[number[1]]} | ${slotItems[number[2]]}\n\nBạn đã thua, toàn bộ ${money} đô bay vào không trung xD. Số tiền hiện tại bạn có: ${moneydb - money}`, threadID, () => Economy.subtractMoney(senderID, parseInt(money)), messageID);
			});
		}

		//pay
		if (contentMessage.indexOf(`${prefix}pay`) == 0) {
			var mention = Object.keys(event.mentions)[0];
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			var moneyPay = content.substring(content.lastIndexOf(" ") + 1);
			Economy.getMoney(senderID).then((moneydb) => {
				if (!moneyPay) return api.sendMessage("Bạn chưa nhập số tiền cần chuyển!", threadID, messageID);
				if (isNaN(moneyPay) || moneyPay.indexOf("-") !== -1) return api.sendMessage(`Số tiền bạn nhập không hợp lệ, vui lòng xem lại cách sử dụng tại ${prefix}help pay`, threadID, messageID);
				if (moneyPay > moneydb) return api.sendMessage('Số tiền mặt trong người bạn không đủ, vui lòng kiểm tra lại số tiền bạn đang có!', threadID, messageID);
				if (moneyPay < 50) return api.sendMessage(`Số tiền cần chuyển của bạn quá nhỏ, tối thiểu là 50 đô!`, threadID, messageID);
				return api.sendMessage({
					body: `Bạn đã chuyển ${moneyPay} đô cho ${event.mentions[mention].replace("@", "")}.`,
					mentions: [{
						tag: event.mentions[mention].replace("@", ""),
						id: mention
					}]
				}, threadID, () => {
					Economy.addMoney(mention, parseInt(moneyPay));
					Economy.subtractMoney(senderID, parseInt(moneyPay));
				}, messageID);
			});
		}

		//setmoney
		if (contentMessage.indexOf(`${prefix}setmoney`) == 0 && admins.includes(senderID)) {
			var mention = Object.keys(event.mentions)[0];
			var content = contentMessage.slice(prefix.length + 9,contentMessage.length);
			var sender = content.slice(0, content.lastIndexOf(" "));
			var moneySet = content.substring(content.lastIndexOf(" ") + 1);
			if (isNaN(moneySet)) return api.sendMessage('Số tiền cần set của bạn không phải là 1 con số!', threadID, messageID);
			if (!mention && sender == 'me') return api.sendMessage("Đã sửa tiền của bản thân thành " + moneySet, threadID, () => Economy.setMoney(senderID, parseInt(moneySet)), messageID);
			return api.sendMessage({
				body: `Bạn đã sửa tiền của ${event.mentions[mention].replace("@", "")} thành ${moneySet} đô.`,
				mentions: [{
					tag: event.mentions[mention].replace("@", ""),
					id: mention
				}]
			}, threadID, () => Economy.setMoney(mention, parseInt(moneySet)), messageID);
		}

		// steal
		if (contentMessage == `${prefix}steal` && senderID != api.getCurrentUserID()) {
			let cooldown = 1800000;
				Economy.getStealTime(senderID).then(function(lastSteal) {
				if (lastSteal !== null && cooldown - (Date.now() - lastSteal) > 0) {
					let time = ms(cooldown - (Date.now() - lastSteal));
					api.sendMessage("Bạn vừa ăn trộm, để tránh bị lên phường vui lòng quay lại sau: " + time.minutes + " phút " + time.seconds + " giây ", threadID, messageID);
				}
				else {
					api.getThreadInfo(threadID, function(err, info) {
						if (err) throw err;
						let victim = info.participantIDs[Math.floor(Math.random() * info.participantIDs.length)];
						User.createUser(victim);
						User.getName(victim).then(nameV => {
							User.getName(senderID).then(name => {
								if (victim == api.getCurrentUserID() && senderID == victim) return api.sendMessage("Cần lao vi tiên thủ\nNăng cán dĩ đắc thực\nVô vi thực đầu buồi\nThực cứt thế cho nhanh", threadID, messageID);
								else if (senderID != victim && victim != api.getCurrentUserID()) {
									var route = Math.floor(Math.random() * 5);
									if (route > 1 || route == 0) {
										Economy.getMoney(victim).then(moneydb => {
											var money = Math.floor(Math.random() * 200) + 1;
											if (moneydb <= 0 || moneydb == undefined) return api.sendMessage("Bạn đen vl, trộm được mỗi cục cứt xD", threadID, messageID);
											else if (moneydb >= money) return api.sendMessage(`Bạn vừa trộm ${money} đô từ 1 thành viên trong nhóm`, threadID, () => {
												Economy.subtractMoney(victim, money);
												Economy.addMoney(senderID, parseInt(money));
											}, messageID);
											else if (moneydb < money) return api.sendMessage(`Bạn vừa trộm TẤT CẢ ${moneydb} đô của 1 thành viên trong nhóm`, threadID, () => {
												Economy.subtractMoney(victim, parseInt(moneydb));
												Economy.addMoney(senderID, parseInt(moneydb));
											}, messageID);
											else return api.sendMessage("Bạn đen vl, trộm được cục cứt xD", threadID, messageID);
										})
									} else if (route == 1) {
										Economy.getMoney(senderID).then(moneydb => {
											if (moneydb <= 0) return api.sendMessage("Cần lao vi tiên thủ\nNăng cán dĩ đắc thực\nVô vi thực đầu buồi\nThực cứt thế cho nhanh", threadID, messageID);
											else if (moneydb > 0) return api.sendMessage(`Bạn bị tóm vì tội ăn trộm, mất ${moneydb} đô`, threadID, () => api.sendMessage({body: `Chúc mừng anh hùng ${nameV} tóm gọn tên trộm ${name} và đã nhận được tiền thưởng ${Math.floor(moneydb / 2)} đô`, mentions: [{ tag: nameV, id: victim}, {tag: name, id: senderID}]}, threadID, () => {
												Economy.subtractMoney(senderID, moneydb);
												Economy.addMoney(victim, parseInt(Math.floor(moneydb / 2)));
											}), messageID);
										})
									}
								}
							})
						})
					})
					Economy.updateStealTime(senderID, Date.now());
				};
			})
			return;
		}

		//fishing
		if (contentMessage.indexOf(`${prefix}fishing`) == 0)
			return (async () => {
				var content = contentMessage.slice(prefix.length + 8, contentMessage.length);
				let inventory = await Fishing.getInventory(senderID);
				if (!content) {
					let stats = await Fishing.getStats(senderID);
					let lastTimeFishing = await Fishing.lastTimeFishing(senderID);
					let moneydb = await Economy.getMoney(senderID);
					if (new Date() - new Date(lastTimeFishing) >= 5000) {
						var roll = Math.floor(Math.random() * 1008);
						lastTimeFishing = new Date();
						stats.casts += 1;
						if (roll <= 400) {
							var arrayTrash = ["🏐","💾","📎","💩","🦴","🥾","🥾","🌂"];
							inventory.trash += 1;
							stats.trash += 1;
							api.sendMessage(arrayTrash[Math.floor(Math.random() * arrayTrash.length)] + ' | Oh, xung quanh bạn toàn là rác êii', threadID, messageID);
						}
						else if (roll > 400 && roll <= 700) {
							inventory.fish1 += 1;
							stats.fish1 += 1;
							api.sendMessage('🐟 | Bạn đã bắt được một con cá cỡ bình thường 😮', threadID, messageID);
						}
						else if (roll > 700 && roll <= 900) {
							inventory.fish2 += 1;
							stats.fish2 += 1;
							api.sendMessage('🐠 | Bạn đã bắt được một con cá hiếm 😮', threadID, messageID);
						}
						else if (roll > 900 && roll <= 960) {
							inventory.crabs += 1;
							stats.crabs += 1;
							api.sendMessage('🦀 | Bạn đã bắt được một con cua siêu to khổng lồ 😮', threadID, messageID);
						}
						else if (roll > 960 && roll <= 1001) {
							inventory.blowfish += 1;
							stats.blowfish += 1;
							api.sendMessage('🐡 | Bạn đã bắt được một con cá nóc *insert meme cá nóc ăn carot .-.*', threadID, messageID);
						}
						else if (roll == 1002) {
							inventory.crocodiles += 1;
							stats.crocodiles += 1;
							api.sendMessage('🐊 | Bạn đã bắt được một con cá sấu đẹp trai hơn cả bạn 😮', threadID, messageID);
						}
						else if (roll == 1003) {
							inventory.whales += 1;
							stats.whales += 1;
							api.sendMessage('🐋 | Bạn đã bắt được một con cá voi siêu to khổng lồ 😮', threadID, messageID);
						}
						else if (roll == 1004) {
							inventory.dolphins += 1;
							stats.dolphins += 1;
							api.sendMessage('🐬 | Damn bro, tại sao bạn lại bắt một con cá heo dễ thương thế kia 😱', threadID, messageID);
						}
						else if (roll == 1006) {
							inventory.squid += 1;
							stats.squid += 1;
							api.sendMessage('🦑 | Bạn đã bắt được một con mực 🤤', threadID, messageID);
						}
						else if (roll == 1007) {
							inventory.sharks += 1;
							stats.sharks += 1;
							api.sendMessage('🦈 | Bạn đã bắt được một con cá mập nhưng không mập 😲', threadID, messageID);
						}
						await Fishing.updateLastTimeFishing(senderID, lastTimeFishing);
						await Fishing.updateInventory(senderID, inventory);
						await Fishing.updateStats(senderID, stats);
						await Economy.subtractMoney(senderID, 2);
					}
					else if (new Date() - new Date(lastTimeFishing) <= 5000) api.sendMessage('Bạn chỉ được câu cá mỗi 5 giây một lần, vui lòng không spam .-.', threadID, messageID);
				}
				else if (content.indexOf('túi') == 0) {
					var total = inventory.trash + inventory.fish1 * 30 + inventory.fish2 * 100 + inventory.crabs * 250 + inventory.blowfish * 300 + inventory.crocodiles * 500 + inventory.whales * 750 + inventory.dolphins * 750 + inventory.squid * 1000 + inventory.sharks * 1000;
					api.sendMessage(
						"===== Inventory Của Bạn =====" +
						"\n- Số lượng:" +
						"\n+ Rác | 🗑️: " + inventory.trash +
						"\n+ Cá cỡ bình thường | 🐟: " + inventory.fish1 +
						"\n+ Cá hiếm | 🐠: " + inventory.fish2 +
						"\n+ Cua | 🦀: " + inventory.crabs +
						"\n+ Cá nóc | 🐡: " + inventory.blowfish +
						"\n+ Cá sấu | 🐊: " + inventory.crocodiles +
						"\n+ Cá voi | 🐋: " + inventory.whales +
						"\n+ Cá heo | 🐬: " + inventory.dolphins +
						"\n+ Mực | 🦑: " + inventory.squid +
						"\n+ Cá mập | 🦈: " + inventory.sharks +
						"\n- Tổng số tiền bạn có thể thu được sau khi bán: " + total + " đô ",
						threadID, messageID
					);
				}
				else if (content.indexOf('bán') == 0) {
					var choose = content.split(' ')[1];
					if (!choose) return api.sendMessage('Chưa nhập thứ cần bán.', threadID, messageID);
					else if (choose == 'trash' || choose == '1') {
						var y = inventory.trash;
						inventory.trash = 0;
						var money = parseInt(1 * y);
						api.sendMessage('🎣 | Bạn đã bán ' + y + ' rác và nhận được ' + money + ' đô', threadID, messageID);
					}
					else if (choose == 'common' || choose == '2') {
						var y = inventory.fish1;
						inventory.fish1 = 0;
						var money = parseInt(30 * y);
						api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá bình thường và nhận được ' + money + ' đô', threadID, messageID);
					}
					else if (choose == 'rare' || choose == '3') {
						var y = inventory.fish2;
						inventory.fish2 = 0;
						var money = parseInt(100 * y);
						api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá hiếm và nhận được ' + money + ' đô', threadID, messageID);
					}
					else if (choose == 'crabs' || choose == '4') {
						var y = inventory.crabs;
						inventory.crabs = 0;
						var money = parseInt(250 * y);
						api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cua và nhận được ' + money + ' đô', threadID, messageID);
					}
					else if (choose == 'blowfish' || choose == '8') {
						var y = inventory.blowfish;
						inventory.blowfish = 0;
						var money = parseInt(300 * y);
						api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá nóc và nhận được ' + money + ' đô', threadID, messageID);
					}
					else if (choose == 'crocodiles' || choose == '5') {
						var y = inventory.crocodiles;
						inventory.crocodiles = 0;
						var money = parseInt(500 * y);
						api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá sấu và nhận được ' + money + ' đô', threadID, messageID);
					}
					else if (choose == 'whales' || choose == '6') {
						var y = inventory.whales;
						inventory.whales = 0;
						var money = parseInt(750 * y);
						api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá voi và nhận được ' + money + ' đô', threadID, messageID);
					}
					else if (choose == 'dolphins' || choose == '7') {
						var y = inventory.dolphins;
						inventory.dolphins = 0;
						var money = parseInt(750 * y);
						api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá heo và nhận được ' + money + ' đô', threadID, messageID);
					}
					else if (choose == 'squid' || choose == '9') {
						var y = inventory.squid;
						inventory.squid = 0;
						var money = parseInt(1000 * y);
						api.sendMessage('🎣 | Bạn đã bán ' + y + ' con mực và nhận được ' + money + ' đô', threadID, messageID);
					}
					else if (choose == 'sharks' || choose == '10') {
						var y = inventory.sharks;
						inventory.sharks = 0;
						var money = parseInt(1000 * y);
						api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá mập và nhận được ' + money + ' đô', threadID, messageID);
					}
					else if (choose == 'all') {
						var money = parseInt(inventory.trash + inventory.fish1 * 30 + inventory.fish2 * 100 + inventory.crabs * 250 + inventory.blowfish * 300 + inventory.crocodiles * 500 + inventory.whales * 750 + inventory.dolphins * 750 + inventory.squid * 1000 + inventory.sharks * 1000);
						inventory.trash = 0;
						inventory.fish1 = 0;
						inventory.fish2 = 0;
						inventory.crabs = 0;
						inventory.crocodiles = 0;
						inventory.whales = 0;
						inventory.dolphins = 0;
						inventory.blowfish = 0;
						inventory.squid = 0;
						inventory.sharks = 0;
						api.sendMessage('🎣 | Bạn đã bán toàn bộ sản lượng trong túi và thu về được ' + money + ' đô', threadID, messageID);
					}
					await Fishing.updateInventory(senderID, inventory);
					await Economy.addMoney(senderID, money);
				} else if (content.indexOf("list") == 0) return api.sendMessage(
						"===== Danh sách tiền của mọi loại cá =====" +
						"\n1/ Rác | 🗑️: 1 đô" +
						"\n2/ Cá cỡ bình thường | 🐟: 30 đô" +
						"\n3/ Cá hiếm | 🐠: 100 đô" +
						"\n4/ Cua | 🦀: 250 đô" +
						"\n5/ Cá nóc | 🐡: 300 đô" +
						"\n6/ Cá sấu | 🐊: 500 đô" +
						"\n7/ Cá voi | 🐋: 750 đô" +
						"\n8/ Cá heo | 🐬: 750 đô" +
						"\n9/ Mực | 🦑: 1000 đô" +
						"\n10/ Cá mập | 🦈: 1000 đô",
						threadID, messageID
					);
			})();
		

		/* ==================== System Check ==================== */

		//Check if command is correct
		if (contentMessage.indexOf(prefix) == 0) {
			var checkCmd, findSpace = contentMessage.indexOf(' ');
			if (findSpace == -1) {
				checkCmd = stringSimilarity.findBestMatch(contentMessage.slice(prefix.length, contentMessage.length), nocmdData.cmds);
				if (checkCmd.bestMatch.target == contentMessage.slice(prefix.length, contentMessage.length)) return;
			}
			else {
				checkCmd = stringSimilarity.findBestMatch(contentMessage.slice(prefix.length, findSpace), nocmdData.cmds);
				if (checkCmd.bestMatch.target == contentMessage.slice(prefix.length, findSpace)) return;
			}
			if (checkCmd.bestMatch.rating >= 0.3) return api.sendMessage(`Lệnh bạn nhập không tồn tại.\nÝ bạn là lệnh "${prefix + checkCmd.bestMatch.target}" phải không?`, threadID, messageID);
		}
	}
}
/* This bot was made by Catalizcs(roxtigger2003) and SpermLord(spermlord) with love <3, pls dont delete this credits! THANKS */