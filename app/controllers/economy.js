const logger = require("../modules/log.js");
module.exports = function({ models, api }) {
	const Economy = models.use("economy");
	
/* ==================== Daily ==================== */

	function getDailyTime(uid) {
		return Economy.findOne({
			where: {
				uid
			}
		}).then(function(economy) {
			if (!economy) return;
			return economy.get({ plain: true }).dailytime;
		});
	}

	function updateDailyTime(uid, dailytime) {
		return Economy.findOne({
			where: {
				uid
			}
		}).then(function(economy) {
			if (!economy) return;
			return economy.update({ dailytime });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}

	/* ==================== Work ==================== */

	function getWorkTime(uid) {
		return Economy.findOne({
			where: {
				uid
			}
		}).then(function(economy) {
			if (!economy) return;
			return economy.get({ plain: true }).worktime;
		});
	}

	function updateWorkTime(uid, worktime) {
		return Economy.findOne({
			where: {
				uid
			}
		}).then(function(economy) {
			if (!economy) return;
			return economy.update({ worktime });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}

	/* ==================== Money ==================== */

	function getMoney(uid) {
		return Economy.findOne({
			where: {
				uid
			}
		}).then(function(economy) {
			if (!economy) return;
			return economy.get({ plain: true }).money;
		});
	}

	function addMoney(uid, moneyIncrement) {
		return Economy.findOne({
			where: {
				uid
			}
		}).then(function(economy) {
			if (!economy) return;
			var moneyData = economy.get({ plain: true }).money;
			return economy.update({ money: moneyData + moneyIncrement });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}

	function subtractMoney(uid, moneyDecrement) {
		return Economy.findOne({
			where: {
				uid
			}
		}).then(function(economy) {
			if (!economy) return;
			var moneyData = economy.get({ plain: true }).money;
			return economy.update({ money: moneyData - moneyDecrement });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}

	function setMoney(uid, money) {
		return Economy.findOne({
			where: {
				uid
			}
		}).then(function(economy) {
			if (!economy) return;
			return economy.update({ money });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}	

/* =================== Steal ==================== */

	function getStealTime(uid) {
		return Economy.findOne({
			where: {
				uid
			}
		}).then(function(user) {
			if (!user) return;
			return user.get({ plain: true }).stealtime;
		});
	}

	function updateStealTime(uid, stealtime) {
		return Economy.findOne({
			where: {
				uid
			}
		}).then(function(user) {
			if (!user) return;
			return user.update({ stealtime });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}

	return {
		getDailyTime,
		updateDailyTime,
		getWorkTime,
		updateWorkTime,
		getMoney,
		addMoney,
		subtractMoney,
		setMoney,
		getStealTime,
		updateStealTime
	};
};
