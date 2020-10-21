const logger = require("../modules/log.js");
module.exports = function({ models, api }) {
	const Fishing = models.use("fishing");

/* ==================== Last Time Fishing ==================== */

	function lastTimeFishing(uid) {
		return Fishing.findOne({
			where: {
				uid
			}
		}).then(function(fishing) {
			if (!fishing) return;
			return fishing.get({ plain: true }).lastTimeFishing;
		});
	}

	function updateLastTimeFishing(uid, lastTimeFishing) {
		return Fishing.findOne({
			where: {
				uid
			}
		}).then(function(fishing) {
			if (!fishing) return;
			return fishing.update({ lastTimeFishing });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}
	
/* ==================== Inventory ==================== */

	function getInventory(uid) {
		return Fishing.findOne({
			where: {
				uid
			}
		}).then(function(fishing) {
			if (!fishing) return;
			return JSON.parse(fishing.get({ plain: true }).inventory);
		});
	}

	function updateInventory(uid, inventory) {
		return Fishing.findOne({
			where: {
				uid
			}
		}).then(function(fishing) {
			if (!fishing) return;
			return fishing.update({ inventory: JSON.stringify(inventory) });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}

/* ==================== Stats ==================== */

	function getStats(uid) {
		return Fishing.findOne({
			where: {
				uid
			}
		}).then(function(fishing) {
			if (!fishing) return;
			return JSON.parse(fishing.get({ plain: true }).stats);
		});
	}

	function updateStats(uid, stats) {
		return Fishing.findOne({
			where: {
				uid
			}
		}).then(function(fishing) {
			if (!fishing) return;
			return fishing.update({ stats: JSON.stringify(stats) });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}

	return {
		lastTimeFishing,
		updateLastTimeFishing,
		getInventory,
		updateInventory,
		getStats,
		updateStats
	};
};
