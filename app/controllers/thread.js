const logger = require("../modules/log.js");
module.exports = function({ models, api }) {
	const Thread = models.use('thread');

	function createThread(threadID) {
		api.getThreadInfo(threadID, (err, info) => {
			if (err) return logger(err, 2);
			var name = info.name;
			Thread.findOrCreate({ where: { threadID }, defaults: { name } }).then(([thread, created]) => {
				if (created) return logger(threadID, 'New Thread');
			}).catch((error) => {
				logger(error, 2);
			})
		})
	}

	function setThread(threadID, options = {}) {
		return Thread.findOne({
			where: {
				threadID
			}
		}).then(function(thread) {
			if (!thread) return;
			return thread.update(options);
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}

	function delThread(threadID) {
		return Thread.findOne({
			where: {
				threadID
			}
		}).then(thread => thread.destroy());
	}

	function getThreads(where = {}) {
		return Thread.findAll({ where }).then(e => e.map(e => e.get({ plain: true }))).catch((error) => {
			logger(error, 2);
			return [];
		})
	}

	function getName(threadID) {
		return Thread.findOne({
			where: {
				threadID
			}
		}).then(function(thread) {
			if (!thread) return;
			return thread.get({ plain: true }).name;
		});
	}

	function updateName(threadID, name) {
		return Thread.findOne({
			where: {
				threadID
			}
		}).then(function(thread) {
			if (!thread) return;
			return thread.update({ name });
		});
	}

	function unban(threadID, block = false) {
		return Thread.findOne({
			where: {
				threadID
			}
		}).then(function(thread) {
			if (!thread) return;
			return thread.update({ block });
		}).then(function () {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		})
	}

	function ban(threadID) {
		return unban(threadID, true);
	}

	function blockResend(threadID, blockResend = true) {
		return Thread.findOne({
			where: {
				threadID
			}
		}).then(function(thread) {
			if (!thread) return;
			return thread.update({ blockResend });
		}).then(function () {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		})
	}

	function unblockResend(threadID) {
		return blockResend(threadID, false);
	}

	function blockNSFW(threadID, blockNSFW = true) {
		return Thread.findOne({
			where: {
				threadID
			}
		}).then(function(thread) {
			if (!thread) return;
			return thread.update({ blockNSFW });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		})
	}

	function unblockNSFW(threadID) {
		return blockNSFW(threadID, false);
	}

	return {
		getThreads,
		createThread,
		setThread,
		delThread,
		getName,
		updateName,
		ban,
		unban,
		blockResend,
		unblockResend,
		blockNSFW,
		unblockNSFW
	}
}